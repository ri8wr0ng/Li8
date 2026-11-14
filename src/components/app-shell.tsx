import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Download, FileText, Library, LogOut, Monitor, Moon, PenLine, Search, Sun, WifiOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Wordmark } from "#/components/brand";
import { useCommandPalette } from "#/components/command-palette";
import { InstallBanner, IosInstallHelp } from "#/components/install-prompt";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useInstall } from "#/lib/install";
import { clearCache, useCachedQuery, useOnline, useReadOnly } from "#/lib/offline";
import { useTheme } from "#/lib/theme";
import { cn } from "#/lib/utils";
import { api } from "../../convex/_generated/api";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function AppShell({ children }: { children: ReactNode }) {
  const { openPalette } = useCommandPalette();
  const notes = useCachedQuery(api.notes.list, "notes");
  const series = useCachedQuery(api.series.list, "series");
  const reading = series?.filter((s) => s.status === "reading").length;
  const newNote = useNewNote();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r px-4 py-6 lg:flex">
        <div className="flex items-center justify-between gap-2 px-2">
          <Link to="/">
            <Wordmark />
          </Link>
          <OfflinePill />
        </div>

        <button
          type="button"
          onClick={openPalette}
          className="flex h-10 items-center gap-2.5 rounded-xl border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-input hover:text-foreground"
        >
          <Search className="size-4" />
          Search or jump…
          <kbd className="ml-auto rounded border bg-background px-1.5 font-mono text-[0.7rem]">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>

        <nav className="flex flex-col gap-0.5">
          <SideLink to="/" icon={<FileText />} label="Notes" count={notes?.length} />
          <SideLink to="/library" icon={<Library />} label="Library" count={reading} countLabel="reading" />
        </nav>

        <Button variant="hanko" className="h-10 rounded-xl" onClick={newNote}>
          <PenLine /> New note
        </Button>

        <div className="mt-auto grid gap-3">
          <InstallBanner />
          <UserMenu align="start" />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="pt-safe sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center justify-between pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
          <Link to="/">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <OfflinePill />
            <UserMenu align="end" compact />
          </div>
        </div>
      </header>

      <main className="min-w-0 pr-[env(safe-area-inset-right)] pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] lg:pb-0">{children}</main>

      <InstallBanner className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-md lg:hidden" />

      {/* Mobile tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-3 items-center pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
          <TabLink to="/" icon={<FileText />} label="Notes" />
          <button
            type="button"
            onClick={openPalette}
            aria-label="Search"
            className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95"
          >
            <Search className="size-5" />
          </button>
          <TabLink to="/library" icon={<Library />} label="Library" />
        </div>
      </nav>
    </div>
  );
}

export function useNewNote() {
  const createNote = useMutation(api.notes.create);
  const navigate = useNavigate();
  const readOnly = useReadOnly();
  return async () => {
    if (readOnly) {
      toast("You're offline. New notes need a connection.");
      return;
    }
    const id = await createNote({});
    await navigate({ to: "/notes/$noteId", params: { noteId: id } });
  };
}

function SideLink({
  to,
  icon,
  label,
  count,
  countLabel,
}: {
  to: "/" | "/library";
  icon: ReactNode;
  label: string;
  count?: number;
  countLabel?: string;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/", includeSearch: false }}
      className="group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:font-medium data-[status=active]:text-foreground [&>svg]:size-4"
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className="ml-auto font-mono text-xs tabular-nums" title={countLabel}>
          {count}
        </span>
      )}
    </Link>
  );
}

function TabLink({ to, icon, label }: { to: "/" | "/library"; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/", includeSearch: false }}
      className="flex flex-col items-center gap-0.5 text-[0.7rem] font-medium text-muted-foreground data-[status=active]:text-foreground [&>svg]:size-5"
    >
      {icon}
      {label}
    </Link>
  );
}

/** Shown only without a connection. Says whether you're looking at the saved copy or edits will sync later. */
function OfflinePill() {
  const online = useOnline();
  const readOnly = useReadOnly();
  if (online) return null;
  return (
    <span
      role="status"
      title={
        readOnly
          ? "You're offline. This is the copy saved on this device; changes are paused until you reconnect."
          : "You're offline. Changes will sync when you reconnect."
      }
      className="flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium text-muted-foreground animate-in fade-in"
    >
      <WifiOff className="size-3.5" />
      {readOnly ? "Offline · read-only" : "Offline"}
    </span>
  );
}

function UserMenu({ align, compact }: { align: "start" | "end"; compact?: boolean }) {
  const me = useCachedQuery(api.users.me, "me");
  const { signOut } = useAuthActions();
  const { theme, setTheme } = useTheme();
  const install = useInstall();
  const [iosHelp, setIosHelp] = useState(false);
  const name = me?.name ?? me?.email ?? "You";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2.5 rounded-xl text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          compact ? "p-0.5" : "w-full p-1.5 hover:bg-accent",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm font-semibold">
          {initials || "·"}
        </span>
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate font-medium">{me?.name ?? "Signed in"}</span>
            {me?.email && <span className="block truncate text-xs text-muted-foreground">{me.email}</span>}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{me?.email ?? name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {install.kind !== "none" && (
          <DropdownMenuItem
            onSelect={() => (install.kind === "ios" ? setIosHelp(true) : void install.install())}
          >
            <Download /> Install app
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void signOut().then(clearCache)}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
      <IosInstallHelp open={iosHelp} onOpenChange={setIosHelp} />
    </DropdownMenu>
  );
}
