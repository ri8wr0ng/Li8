import { useAuthActions } from "@convex-dev/auth/react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Download, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ShortcutList } from "#/components/help-dialog";
import { IosInstallHelp } from "#/components/install-prompt";
import { PageHeader } from "#/components/page";
import { Button } from "#/components/ui/button";
import { UserAvatar } from "#/components/user-avatar";
import { useInstall } from "#/lib/install";
import { clearCache, useCachedQuery, useOnline } from "#/lib/offline";
import { type Theme, useTheme } from "#/lib/theme";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const THEMES: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
  { value: "system", label: "Match device", icon: <Monitor /> },
];

function SettingsPage() {
  const me = useCachedQuery(api.users.me, "me");
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuthActions();
  const install = useInstall();
  const online = useOnline();
  const [iosHelp, setIosHelp] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader title="Settings" />

      <Section title="Account">
        <Link
          to="/profile"
          className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent/60"
        >
          <UserAvatar user={me} className="size-11" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{me?.name ?? "Signed in"}</span>
            <span className="block truncate text-sm text-muted-foreground">{me?.email}</span>
          </span>
          <span className="shrink-0 text-sm text-muted-foreground">Edit profile</span>
        </Link>
      </Section>

      <Section title="Appearance" description="Dark mode can also be switched from the sidebar.">
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border bg-card px-3 py-4 text-sm font-medium outline-none transition-[border-color,box-shadow,color] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:size-5",
                theme === t.value
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="This device">
        <div className="divide-y rounded-xl border bg-card">
          {install.kind !== "none" && (
            <Row
              title="Install Inkmark"
              description="Open it from your home screen or dock, and use it offline."
            >
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => (install.kind === "ios" ? setIosHelp(true) : void install.install())}
              >
                <Download /> Install
              </Button>
            </Row>
          )}
          <Row
            title="Saved copy"
            description="Your notes and library are kept on this device so they open offline. Clearing it downloads them again."
          >
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={!online}
              title={online ? undefined : "Connect first, so the copy can be downloaded again"}
              onClick={() =>
                void clearCache().then(() => toast("Saved copy cleared. It refills as you browse."))
              }
            >
              Clear
            </Button>
          </Row>
        </div>
      </Section>

      <Section title="Keyboard shortcuts">
        <ShortcutList />
      </Section>

      <Section
        title="Sign out"
        description="Signing out also clears the saved copy on this device."
      >
        <Button
          variant="outline"
          className="rounded-xl text-destructive hover:text-destructive"
          onClick={() => void signOut().then(clearCache)}
        >
          <LogOut /> Sign out
        </Button>
      </Section>

      <IosInstallHelp open={iosHelp} onOpenChange={setIosHelp} />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
