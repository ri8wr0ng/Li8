import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, AppState, Platform } from "react-native";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import * as IntentLauncher from "expo-intent-launcher";
import { File, Paths } from "expo-file-system";
import {
  channelOfVersion,
  formatBytes,
  isReleaseList,
  latestBuild,
  parseReleases,
  updateStatus,
  type Build,
  type InstalledBuild,
  type UpdateChannel,
  type UpdateStatus,
} from "./releases";

// Set by .github/workflows/mobile-release.yml to the repo that publishes the APKs.
const RELEASES_REPO = process.env.EXPO_PUBLIC_RELEASES_REPO || "ri8wr0ng/li8";
const RELEASES_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=50`;

const CHANNEL_KEY = "inkmark_update_channel";
// The tag the launch prompt last offered, so it asks once per build rather than every launch.
const PROMPTED_KEY = "inkmark_update_prompted";
// Re-check when the app returns to the foreground at most this often.
const RECHECK_MS = 6 * 60 * 60 * 1000;

const APK_MIME = "application/vnd.android.package-archive";
const FLAG_GRANT_READ_URI_PERMISSION = 1;

/** Only release APKs can update themselves; dev builds and iOS can't. */
export const updatesSupported = Platform.OS === "android" && !__DEV__;

export const installedBuild: InstalledBuild = {
  version: Application.nativeApplicationVersion,
  versionCode: Number(Application.nativeBuildVersion) || null,
};

type CheckState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "done"; status: UpdateStatus; checkedAt: number }
  | { phase: "error"; message: string };

type InstallState =
  | { phase: "idle" }
  | { phase: "downloading"; progress: number | null }
  | { phase: "error"; message: string };

type Updater = {
  channel: UpdateChannel;
  setChannel: (channel: UpdateChannel) => void;
  check: CheckState;
  install: InstallState;
  checkForUpdates: () => Promise<UpdateStatus | null>;
  installBuild: (build: Build) => Promise<void>;
};

const UpdaterContext = createContext<Updater | null>(null);

async function fetchStatus(channel: UpdateChannel): Promise<UpdateStatus> {
  const response = await fetch(RELEASES_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? "GitHub is rate limiting update checks. Try again later."
        : `GitHub answered ${response.status}.`,
    );
  }
  const releases: unknown = await response.json();
  if (!isReleaseList(releases)) throw new Error("GitHub sent an unexpected response.");
  return updateStatus(installedBuild, latestBuild(parseReleases(releases), channel));
}

export function UpdaterProvider({ children }: { children: ReactNode }) {
  const [channel, setChannelState] = useState<UpdateChannel>(() =>
    channelOfVersion(installedBuild.version),
  );
  const [channelLoaded, setChannelLoaded] = useState(false);
  const [check, setCheck] = useState<CheckState>({ phase: "idle" });
  const [install, setInstall] = useState<InstallState>({ phase: "idle" });
  const channelRef = useRef(channel);
  const lastCheckRef = useRef(0);
  const installingRef = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(CHANNEL_KEY)
      .then((saved) => {
        if (saved === "stable" || saved === "nightly") {
          channelRef.current = saved;
          setChannelState(saved);
        }
      })
      .catch(() => {})
      .finally(() => setChannelLoaded(true));
  }, []);

  const checkForUpdates = useCallback(async () => {
    const requested = channelRef.current;
    setCheck({ phase: "checking" });
    try {
      const status = await fetchStatus(requested);
      // A channel switch while this was in flight starts its own check.
      if (channelRef.current !== requested) return null;
      lastCheckRef.current = Date.now();
      setCheck({ phase: "done", status, checkedAt: lastCheckRef.current });
      return status;
    } catch (error) {
      if (channelRef.current === requested) {
        const message = error instanceof Error ? error.message : "Couldn't reach GitHub.";
        setCheck({ phase: "error", message });
      }
      return null;
    }
  }, []);

  const installBuild = useCallback(async (build: Build) => {
    if (!updatesSupported || installingRef.current) return;
    installingRef.current = true;
    setInstall({ phase: "downloading", progress: null });
    try {
      // One fixed file, overwritten each time, so old downloads don't pile up in the cache.
      const destination = new File(Paths.cache, "inkmark-update.apk");
      const file = await File.downloadFileAsync(build.apkUrl, destination, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          const total = totalBytes > 0 ? totalBytes : build.apkSize;
          setInstall({
            phase: "downloading",
            progress: total > 0 ? Math.min(1, bytesWritten / total) : null,
          });
        },
      });
      setInstall({ phase: "idle" });
      // Android's package installer takes over from here. The first time, it asks to allow
      // installing apps from li8.
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: file.contentUri,
        type: APK_MIME,
        flags: FLAG_GRANT_READ_URI_PERMISSION,
      });
    } catch (error) {
      console.error("Update install failed:", error);
      setInstall({
        phase: "error",
        message: "Couldn't download the update. Check your connection and try again.",
      });
    } finally {
      installingRef.current = false;
    }
  }, []);

  const setChannel = useCallback(
    (next: UpdateChannel) => {
      if (next === channelRef.current) return;
      channelRef.current = next;
      setChannelState(next);
      SecureStore.setItemAsync(CHANNEL_KEY, next).catch(() => {});
      if (updatesSupported) void checkForUpdates();
    },
    [checkForUpdates],
  );

  // Check on launch, offer the update once per build, and re-check on returning to the app.
  useEffect(() => {
    if (!updatesSupported || !channelLoaded) return undefined;

    const checkAndPrompt = async () => {
      const status = await checkForUpdates();
      if (status?.kind !== "available") return;
      const { build } = status;
      const prompted = await SecureStore.getItemAsync(PROMPTED_KEY).catch(() => null);
      if (prompted === build.tag) return;
      await SecureStore.setItemAsync(PROMPTED_KEY, build.tag).catch(() => {});
      Alert.alert(
        "Update available",
        `li8 ${build.version} is ready (${formatBytes(build.apkSize)}).`,
        [
          { text: "Later", style: "cancel" },
          { text: "Update", onPress: () => void installBuild(build) },
        ],
      );
    };

    void checkAndPrompt();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastCheckRef.current > RECHECK_MS) {
        void checkAndPrompt();
      }
    });
    return () => subscription.remove();
  }, [channelLoaded, checkForUpdates, installBuild]);

  const value = useMemo(
    () => ({ channel, setChannel, check, install, checkForUpdates, installBuild }),
    [channel, setChannel, check, install, checkForUpdates, installBuild],
  );

  return <UpdaterContext.Provider value={value}>{children}</UpdaterContext.Provider>;
}

export function useUpdater(): Updater {
  const updater = useContext(UpdaterContext);
  if (!updater) throw new Error("useUpdater must be used inside UpdaterProvider");
  return updater;
}
