import { Link } from "@tanstack/react-router";
import { Share, SquarePlus, X } from "lucide-react";
import { useState } from "react";
import { LogoMark } from "#/components/brand";
import { useLatestApk } from "#/components/download-app";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { bannerWanted, dismissBanner, useInstall } from "#/lib/install";
import { usePlatform } from "#/lib/platform";
import { cn } from "#/lib/utils";

/**
 * A quiet card offering to install the app. On phones it floats above the tab
 * bar; on desktop it sits in the sidebar. Hidden once installed or dismissed.
 */
export function InstallBanner({ className }: { className?: string }) {
  const install = useInstall();
  const platform = usePlatform();
  const [visible, setVisible] = useState(bannerWanted);
  const [iosHelp, setIosHelp] = useState(false);
  if (!visible || (platform !== "android" && install.kind === "none")) return null;

  function close() {
    dismissBanner();
    setVisible(false);
  }

  if (platform === "android") {
    return <ApkBanner className={className} onClose={close} />;
  }
  if (install.kind === "none") return null;

  return (
    <>
      <div
        role="region"
        aria-label="Install li8"
        className={cn(
          "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[0_12px_32px_-16px_rgba(28,26,23,0.35)] animate-in fade-in slide-in-from-bottom-2 duration-300",
          className,
        )}
      >
        <LogoMark className="size-9 rounded-[0.6rem]" />
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <div className="font-medium">Install li8</div>
          <div className="text-xs text-muted-foreground">Opens offline, from your home screen.</div>
        </div>
        <Button
          size="sm"
          className="rounded-lg"
          onClick={async () => {
            if (install.kind === "ios") return setIosHelp(true);
            if (await install.install()) setVisible(false);
          }}
        >
          Install
        </Button>
        <button
          type="button"
          onClick={close}
          aria-label="Not now"
          className="-mr-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <IosInstallHelp open={iosHelp} onOpenChange={setIosHelp} />
    </>
  );
}

function ApkBanner({ className, onClose }: { className?: string; onClose: () => void }) {
  const apk = useLatestApk();

  return (
    <div
      role="region"
      aria-label="Get the li8 Android app"
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[0_12px_32px_-16px_rgba(28,26,23,0.35)] animate-in fade-in slide-in-from-bottom-2 duration-300",
        className,
      )}
    >
      <LogoMark className="size-9 rounded-[0.6rem]" />
      <div className="min-w-0 flex-1 text-sm leading-tight">
        <div className="font-medium">Get li8 for Android</div>
        <div className="text-xs text-muted-foreground">Works offline and updates itself.</div>
      </div>
      <Button size="sm" className="rounded-lg" asChild>
        {apk ? (
          <a href={apk.apkUrl} download>
            Download
          </a>
        ) : (
          <Link to="/download" search={{ platform: "android" }}>
            Download
          </Link>
        )}
      </Button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Not now"
        className="-mr-1 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function IosInstallHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add li8 to your Home Screen</DialogTitle>
          <DialogDescription>
            It opens full screen and works without a connection.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3 text-sm">
          <li className="flex items-center gap-3">
            <Step n={1} />
            <span>
              Tap <Share className="inline size-4 -translate-y-px" aria-label="Share" />{" "}
              <b>Share</b> in Safari's toolbar.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Step n={2} />
            <span>
              Choose <SquarePlus className="inline size-4 -translate-y-px" aria-hidden />{" "}
              <b>Add to Home Screen</b>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Step n={3} />
            <span>
              Tap <b>Add</b>.
            </span>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary font-mono text-xs font-semibold tabular-nums">
      {n}
    </span>
  );
}
