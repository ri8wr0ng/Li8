import { cn } from "#/lib/utils";

/** The Inkmark mark: a bookmark ribbon with two lines of ink, on Hanko red. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="64" height="64" rx="14" fill="#E5412D" />
      <path d="M21 12h22a2 2 0 0 1 2 2v38l-13-9-13 9V14a2 2 0 0 1 2-2z" fill="#F7F4EE" />
      <rect x="25" y="20" width="14" height="3.2" rx="1.6" fill="#1C1A17" />
      <rect x="25" y="27" width="9" height="3.2" rx="1.6" fill="#1C1A17" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className="font-display text-[1.35rem] font-semibold tracking-[-0.02em]">Inkmark</span>
    </span>
  );
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <LogoMark className="size-12 animate-pulse" />
    </div>
  );
}
