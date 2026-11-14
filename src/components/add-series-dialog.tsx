import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { KIND_LABEL, KIND_ORDER, STATUS_LABEL, STATUS_ORDER, parseChapterCommand } from "#/lib/series";
import { api } from "../../convex/_generated/api";
import type { SeriesKind, SeriesStatus } from "../../convex/validators";

export function AddSeriesDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        {open && <AddSeriesForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddSeriesForm({ onDone }: { onDone: () => void }) {
  const create = useMutation(api.series.create);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [chapter, setChapter] = useState("");
  const [altNames, setAltNames] = useState("");
  const [kind, setKind] = useState<SeriesKind>("manhua");
  const [status, setStatus] = useState<SeriesStatus>("reading");
  const [pending, setPending] = useState(false);

  // Typing "Battle Through The Heavens 348" fills both fields.
  const parsed = !chapter ? parseChapterCommand(title) : null;
  const finalTitle = parsed && parsed.chapter !== undefined ? parsed.name : title.trim();
  const finalChapter = chapter ? Number(chapter) : parsed?.chapter ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalTitle) return;
    setPending(true);
    try {
      const id = await create({
        title: finalTitle,
        chapter: finalChapter,
        kind,
        status,
        altNames: altNames.split(","),
      });
      onDone();
      toast.success(`Added ${finalTitle}`, {
        action: { label: "Open", onClick: () => navigate({ to: "/library/$seriesId", params: { seriesId: id } }) },
      });
    } catch (err) {
      console.error(err);
      toast.error("Couldn't add that series.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Add to Library</DialogTitle>
        <DialogDescription>Tip: type the name and chapter together, like “Solo Leveling 120”.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="series-title">Title</Label>
        <Input
          id="series-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Battle Through The Heavens"
          autoComplete="off"
        />
        {parsed?.chapter !== undefined && (
          <p className="text-xs text-muted-foreground">
            Will add <b className="text-foreground">{parsed.name}</b> at chapter{" "}
            <b className="text-foreground">{parsed.chapter}</b>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="series-chapter">Last chapter read</Label>
          <Input
            id="series-chapter"
            inputMode="decimal"
            type="number"
            min={0}
            step="any"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder={parsed?.chapter !== undefined ? String(parsed.chapter) : "0"}
            className="font-mono"
          />
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as SeriesKind)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="series-alt">Alternative names</Label>
        <Input
          id="series-alt"
          value={altNames}
          onChange={(e) => setAltNames(e.target.value)}
          placeholder="BTTH, Doupo Cangqiong, 斗破苍穹"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Separate with commas. Search finds any of them.</p>
      </div>

      <div className="grid gap-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as SeriesStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" variant="hanko" className="rounded-xl" disabled={!finalTitle || pending}>
          Add series
        </Button>
      </DialogFooter>
    </form>
  );
}
