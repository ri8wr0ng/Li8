import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronsUpDown,
  CircleHelp,
  Download,
  FileText,
  Library,
  LogOut,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Search,
  Settings,
  Sparkles,
  Tag,
  UserRound,
  WifiOff,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AiPanel, AiPanelProvider, useAiPanel } from "#/components/ask/ai-panel";
import { Wordmark } from "#/components/brand";
import { useCommandPalette } from "#/components/command-palette";
import { HelpDialog } from "#/components/help-dialog";
import { InstallBanner, IosInstallHelp } from "#/components/install-prompt";
import { MobileNav } from "#/components/mobile-nav";
import { Button } from "#/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { UserAvatar } from "#/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "#/components/ui/sidebar";
import { useInstall } from "#/lib/install";
import { clearCache, useCachedQuery, useOnline, useReadOnly } from "#/lib/offline";
import { useTheme } from "#/lib/theme";
import { api } from "@inkmark/backend/convex/_generated/api";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AiPanelProvider>
      <SidebarProvider>
        <Shell>{children}</Shell>
      </SidebarProvider>
    </AiPanelProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { openPalette } = useCommandPalette();
  const panel = useAiPanel();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const newNote = useNewNote();
  const { isMobile, setOpenMobile } = useSidebar();

  // On phones the sidebar is a sheet over the page: every entry in it closes the
  // sheet as it's tapped, so you land on the page (or palette) straight away.
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  const closeThen = (action: () => void) => () => {
    closeMobile();
    action();
  };

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="flex-row items-center justify-between gap-2 p-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <Link
            to="/"
            onClick={closeMobile}
            aria-label="li8 home"
            className="flex min-w-0 items-center"
          >
            <Wordmark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
          </Link>
          <span className="ml-auto group-data-[collapsible=icon]:hidden">
            <OfflinePill />
          </span>
          {/* Desktop only: on phones the sidebar is a sheet with its own close gesture. */}
          {!isMobile && <CollapseButton />}
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            {/* Three clusters (find, create, go), separated by space rather than rules. */}
            <SidebarGroupContent className="flex flex-col gap-4">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={closeThen(openPalette)} tooltip="Search">
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
                      onClick={closeThen(panel.toggle)}
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
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={closeThen(() => void newNote())}
                    tooltip="New note"
                    className="bg-hanko font-medium text-hanko-foreground hover:bg-hanko/90 hover:text-hanko-foreground active:bg-hanko/90 data-[active=true]:bg-hanko data-[active=true]:text-hanko-foreground"
                  >
                    <PenLine />
                    <span>New note</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>

              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === "/" || pathname.startsWith("/notes")}
                    tooltip="Notes"
                  >
                    <Link onClick={closeMobile} to="/">
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
                    <Link onClick={closeMobile} to="/library">
                      <Library />
                      <span>Library</span>
                    </Link>
                  </SidebarMenuButton>
                  <LabelLinks onNavigate={closeMobile} />
                </SidebarMenuItem>
                {panel.available && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname.startsWith("/ask")} tooltip="Ask">
                      <Link onClick={closeMobile} to="/ask">
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
          <SystemGroup onNavigate={closeMobile} />
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

      <MobileNav showAsk={panel.available} onSearch={openPalette} />
    </>
  );
}

/** Collapses the sidebar to icons and back (also ⌘B / Ctrl+B). */
function CollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={label}
          aria-expanded={!collapsed}
          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label} <span className="ml-1 opacity-70">{modKey} B</span>
      </TooltipContent>
    </Tooltip>
  );
}

/** Theme, settings and help: the things you reach for rarely, kept at the foot of the sidebar. */
function SystemGroup({ onNavigate }: { onNavigate: () => void }) {
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [help, setHelp] = useState(false);
  const dark = resolvedTheme === "dark";

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>System</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setTheme(dark ? "light" : "dark")}
            tooltip={dark ? "Light mode" : "Dark mode"}
            role="switch"
            aria-checked={dark}
          >
            <Moon />
            <span>Dark mode</span>
            {/* Visual only: the whole row is the switch. */}
            <span
              aria-hidden
              data-state={dark ? "checked" : "unchecked"}
              className="ml-auto inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full bg-input p-px transition-colors data-[state=checked]:bg-primary group-data-[collapsible=icon]:hidden"
            >
              <span className="block size-4 rounded-full bg-background shadow-xs transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] in-data-[state=checked]:translate-x-3.5 motion-reduce:transition-none" />
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip="Settings">
            <Link to="/settings" onClick={onNavigate}>
              <Settings />
              <span>Settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => {
              onNavigate();
              setHelp(true);
            }}
            tooltip="Help and shortcuts"
          >
            <CircleHelp />
            <span>Help & shortcuts</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <HelpDialog open={help} onOpenChange={setHelp} />
    </SidebarGroup>
  );
}

/** Each label as a shortcut into the Library filtered by it. */
function LabelLinks({ onNavigate }: { onNavigate: () => void }) {
  const labels = useQuery(api.labels.list);
  const location = useRouterState({ select: (s) => s.location });
  if (!labels || labels.length === 0) return null;
  const current =
    location.pathname === "/library" ? (location.search as { label?: string[] }).label : undefined;
  return (
    <SidebarMenuSub>
      {labels.map((l) => (
        <SidebarMenuSubItem key={l._id}>
          <SidebarMenuSubButton asChild isActive={current?.length === 1 && current[0] === l._id}>
            <Link to="/library" search={{ label: [l._id] }} onClick={onNavigate}>
              <Tag />
              <span>{l.name}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
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
  const install = useInstall();
  const { isMobile, setOpenMobile } = useSidebar();
  const [iosHelp, setIosHelp] = useState(false);
  const close = () => isMobile && setOpenMobile(false);
  const avatar = <UserAvatar user={me} />;

  return (
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger
          aria-label="Account"
          className="flex items-center gap-2.5 rounded-full p-0.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {avatar}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
            {avatar}
            <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-sm font-medium">{me?.name ?? "Signed in"}</span>
              {me?.email && (
                <span className="block truncate text-xs text-muted-foreground">{me.email}</span>
              )}
            </span>
            <ChevronsUpDown className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align={align}
        side={compact ? "bottom" : "top"}
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
          <UserAvatar user={me} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{me?.name ?? "Signed in"}</span>
            {me?.email && (
              <span className="block truncate text-xs text-muted-foreground">{me.email}</span>
            )}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" onClick={close}>
            <UserRound /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" onClick={close}>
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        {install.kind !== "none" && (
          <DropdownMenuItem
            onSelect={() => (install.kind === "ios" ? setIosHelp(true) : void install.install())}
          >
            <Download /> Install app
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut().then(clearCache)}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
      <IosInstallHelp open={iosHelp} onOpenChange={setIosHelp} />
    </DropdownMenu>
  );
}
