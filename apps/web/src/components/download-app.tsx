import { Link } from "@tanstack/react-router";
import { ArrowRight, Smartphone } from "lucide-react";
import type { SVGProps } from "react";
import { useReleases } from "#/hooks/use-releases";
import { usePlatform } from "#/lib/platform";
import { latestBuild, type Build } from "#/lib/releases";
import { cn } from "#/lib/utils";

const BUTTON =
  "inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 text-[0.95rem] font-medium text-primary-foreground shadow-[0_1px_0_rgb(28_26_23/0.04),0_10px_24px_-14px_rgb(28_26_23/0.6)] transition-[background-color,scale] duration-150 hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97] sm:w-auto";

/** Latest published Android build (stable preferred, falling back to nightly), or null while loading. */
export function useLatestApk(): Build | null {
  const releases = useReleases();
  return releases.status === "ready"
    ? (latestBuild(releases.builds, "stable") ?? latestBuild(releases.builds, "nightly"))
    : null;
}

/**
 * The landing page's download button. Android and computers get the latest APK directly (the
 * Android app is the only native build); iPhones go to the install steps for the web app.
 */
export function DownloadAppButton({ className }: { className?: string }) {
  const platform = usePlatform();
  const build = useLatestApk();

  if (platform === "iphone") {
    return (
      <Link to="/download" search={{ platform: "iphone" }} className={cn(BUTTON, className)}>
        <Smartphone className="size-5" />
        Get li8 on iPhone
      </Link>
    );
  }

  // Until the release list loads (or if it fails), the button opens the download page.
  if (build === null) {
    return (
      <Link to="/download" search={{ platform: "android" }} className={cn(BUTTON, className)}>
        <AndroidLogo className="size-5" />
        Download for Android
      </Link>
    );
  }

  return (
    <a href={build.apkUrl} download className={cn(BUTTON, className)}>
      <AndroidLogo className="size-5" />
      Download for Android
    </a>
  );
}

/** The quiet line under the button, for every other platform and build. */
export function OtherDownloadsLink() {
  return (
    <Link
      to="/download"
      className="group inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      Other devices and versions
      <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}

/** The Android robot's head. */
export function AndroidLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M2 19a10 10 0 0 1 20 0Z M8.75 15a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 1 1 2.5 0Z M17.75 15a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 1 1 2.5 0Z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M5.8 11.4 3.9 8.2M18.2 11.4l1.9-3.2"
      />
    </svg>
  );
}
