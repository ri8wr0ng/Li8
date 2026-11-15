import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  Download,
  FileText,
  Library,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  PenLine,
  Search,
  Sparkles,
  Sun,
  WifiOff,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AiPanel, AiPanelProvider, useAiPanel } from "#/components/ask/ai-panel";
import { Wordmark } from "#/components/brand";
import { useCommandPalette } from "#/components/command-palette";
import { InstallBanner, IosInstallHelp } from "#/components/install-prompt";
import { MobileNav } from "#/components/mobile-nav";
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "#/components/ui/sidebar";
import { useInstall } from "#/lib/install";
import { clearCache, useCachedQuery, useOnline, useReadOnly } from "#/lib/offline";
import { useTheme } from "#/lib/theme";
import { api } from "../../convex/_generated/api";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AiPanelProvider>
      <Shell>{children}</Shell>
    </AiPanelProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { openPalette } = useCommandPalette();
  const panel = useAiPanel();
  const chatStatus = useQuery(api.chat.status, {});
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const newNote = useNewNote();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="flex-row items-center justify-between gap-2 p-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <Link to="/" aria-label="Inkmark home" className="flex min-w-0 items-center">
            <Wordmark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
          </Link>
          <span className="group-data-[collapsible=icon]:hidden">
            <OfflinePill />
          </span>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={openPalette} tooltip="Search">
                    <Search />
                    <span>Search</span>
                    <kbd className="ml-auto rounded border bg-background px-1.5 font-mono text-[0.7rem] group-data-[collapsible=icon]:hidden">
                      {modKey} K
                    </kbd>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {panel.available && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={panel.toggle}
                      tooltip="Ask AI"
                      aria-pressed={panel.open}
                    >
                      <Sparkles />
                      <span>Ask AI</span>
                      <kbd className="ml-auto rounded border bg-background px-1.5 font-mono text-[0.7rem] group-data-[collapsible=icon]:hidden">
                        {modKey} J
                      </kbd>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>

              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={newNote}
                    tooltip="New note"
                    className="bg-hanko font-medium text-hanko-foreground hover:bg-hanko/90 hover:text-hanko-foreground active:bg-hanko/90 data-[active=true]:bg-hanko data-[active=true]:text-hanko-foreground"
                  >
                    <PenLine />
                    <span>New note</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>

              <SidebarSeparator />

              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/" || pathname.startsWith("/notes")}
                    tooltip="Notes"
                  >
                    <Link to="/">
                      <FileText />
                      <span>Notes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/library")}
                    tooltip="Library"
                  >
                    <Link to="/library">
                      <Library />
                      <span>Library</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {chatStatus?.enabled && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith("/ask")} tooltip="Ask">
                      <Link to="/ask">
                        <MessageCircle />
                        <span>Ask</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <InstallBanner />
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu align="start" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <div className="flex min-w-0 flex-1">
        <SidebarInset className="min-w-0">
          {/* Mobile top bar */}
          <header className="pt-safe sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md lg:hidden">
            <div className="flex h-14 items-center gap-1 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
              <SidebarTrigger className="-ml-1 size-9" />
              <Link to="/">
                <Wordmark />
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <OfflinePill />
                {/* Ask AI lives in the bottom nav on phones, next to search. */}
                <UserMenu align="end" compact />
              </div>
            </div>
          </header>

          <div className="min-w-0 flex-1 pr-[env(safe-area-inset-right)] pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] lg:pb-0">
            {children}
          </div>
        </SidebarInset>

        <AiPanel />
      </div>

      <InstallBanner className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-md lg:hidden" />

      <MobileNav showAsk={chatStatus?.enabled === true} onSearch={openPalette} />
    </SidebarProvider>
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
  const avatar = (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm font-semibold">
      {initials || "·"}
    </span>
  );

  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl p-0.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {avatar}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg">
            {avatar}
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-medium">{me?.name ?? "Signed in"}</span>
              {me?.email && (
                <span className="block truncate text-xs text-muted-foreground">{me.email}</span>
              )}
            </span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {me?.email ?? name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Theme
        </DropdownMenuLabel>
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
