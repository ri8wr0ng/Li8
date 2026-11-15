import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Kbd } from "#/components/ui/kbd";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

export const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: [mod, "K"], action: "Search notes and your library" },
  { keys: [mod, "J"], action: "Open or close Ask AI" },
  { keys: [mod, "B"], action: "Show or hide the sidebar" },
  { keys: ["/"], action: "Jump to the search box on a page" },
];

export function ShortcutList() {
  return (
    <dl className="divide-y rounded-xl border bg-card">
      {SHORTCUTS.map((s) => (
        <div key={s.action} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-sm">{s.action}</dt>
          <dd className="flex shrink-0 gap-1">
            {s.keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function HelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Help and shortcuts</DialogTitle>
          <DialogDescription>The quick ways to get around Inkmark.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Tip title="Log a chapter in one line">
            Open search and type a title with a number, like <Kbd>btth 349</Kbd>. Inkmark moves that
            series to chapter 349, or offers to add it if it's new.
          </Tip>
          <Tip title="Bump progress from the list">
            On a phone, swipe a series card right to add one chapter or episode.
          </Tip>
          <Tip title="Offline">
            Your notes and library stay readable without a connection. Edits made offline sync when
            you're back.
          </Tip>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Keyboard shortcuts</h3>
            <ShortcutList />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
