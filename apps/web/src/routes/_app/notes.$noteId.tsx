import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Copy,
  FileQuestion,
  MoreHorizontal,
  LogOut,
  Pin,
  PinOff,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { ChipInput } from "#/components/chip-input";
import { ShareDialog } from "#/components/share-dialog";
import { HighlightTextarea, type HighlightTextareaHandle } from "#/components/highlight-textarea";
import { EmptyState } from "#/components/page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { findAll } from "#/lib/highlight";
import { useCachedList, useOnline, useReadOnly } from "#/lib/offline";
import { pageTitle, useDocumentTitle } from "#/lib/seo";
import { relativeTime } from "#/lib/time";
import { cn } from "#/lib/utils";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc, Id } from "@inkmark/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_app/notes/$noteId")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q.trim() ? { q: search.q } : {},
  head: () => ({ meta: [{ title: pageTitle("Note") }] }),
  component: NotePage,
  errorComponent: NotFound,
});

function NotePage() {
  const { noteId } = Route.useParams();
  const { isAuthenticated } = useConvexAuth();
  const online = useOnline();
  // Route params are plain strings; the query validates the id with v.id().
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const live = useQuery(api.notes.get, isAuthenticated ? { id: noteId as Id<"notes"> } : "skip");
  // Until the live copy arrives (or with no connection), show the saved one.
  const list = useCachedList<Doc<"notes">>("notes");
  const cached = list?.find((n) => n._id === noteId);
  const note = live !== undefined ? live : (cached ?? (list && !online ? null : undefined));
  useDocumentTitle(note ? note.title.trim() || "Untitled" : undefined);
  if (note === undefined) return null;
  if (note === null) return <NotFound />;
  return <Editor key={note._id} note={note} />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <EmptyState icon={<FileQuestion />} title="This note isn't here">
        It may have been deleted on another device.
        <div className="mt-4">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/">Back to notes</Link>
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}

type SaveState = "saved" | "saving" | "error";

/** Debounced autosave. Local edits win; flushes on unmount and before the tab closes. */
function useAutosave(id: Id<"notes">) {
  const update = useMutation(api.notes.update);
  const pending = useRef<{ title?: string; body?: string; tags?: string[] }>({});
  const inFlight = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [state, setState] = useState<SaveState>("saved");

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    inFlight.current++;
    try {
      await update({ id, ...patch });
      inFlight.current--;
      if (inFlight.current === 0 && Object.keys(pending.current).length === 0) setState("saved");
    } catch (err) {
      inFlight.current--;
      console.error(err);
      pending.current = { ...patch, ...pending.current };
      setState("error");
    }
  }, [id, update]);

  const queue = useCallback(
    (patch: typeof pending.current, delay = 600) => {
      Object.assign(pending.current, patch);
      setState("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  const isDirty = () => Object.keys(pending.current).length > 0 || inFlight.current > 0;
  return { state, queue, flush, isDirty };
}

/** Pick what to find when arriving from search: the whole query, or its first word that appears. */
function initialFind(body: string, q: string | undefined) {
  if (!q) return "";
  if (findAll(body, q).length) return q;
  return q.split(/\s+/).find((w) => w.length > 1 && findAll(body, w).length) ?? q;
}

function Editor({ note }: { note: Doc<"notes"> }) {
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const setPinned = useMutation(api.notes.update);
  const remove = useMutation(api.notes.remove);
  const duplicate = useMutation(api.notes.duplicate);
  const setArchived = useMutation(api.notes.setArchived);
  const unshare = useMutation(api.notes.unshare);
  const access = useQuery(api.notes.access, { id: note._id });
  const me = useQuery(api.users.me, {});
  const save = useAutosave(note._id);
  const offlineReadOnly = useReadOnly();
  const role = access?.role ?? "owner";
  const isOwner = role === "owner";
  const readOnly = offlineReadOnly || role === "view";

  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  async function archive() {
    try {
      await setArchived({ id: note._id, archived: true });
      toast("Note archived", {
        action: {
          label: "Undo",
          onClick: () => {
            void setArchived({ id: note._id, archived: false }).catch((err: unknown) =>
              toast.error(mutationErrorMessage(err)),
            );
          },
        },
      });
      await navigate({ to: "/" });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  async function unarchive() {
    try {
      await setArchived({ id: note._id, archived: false });
      toast("Note restored");
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  async function makeCopy() {
    try {
      await save.flush();
      const id = await duplicate({ id: note._id });
      toast("Copy made");
      await navigate({ to: "/notes/$noteId", params: { noteId: id } });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  async function leaveSharedNote() {
    if (!me?.id) return;
    try {
      await unshare({ id: note._id, userId: me.id });
      toast("Removed from your shared notes");
      await navigate({ to: "/" });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }

  // Take edits made on another device, unless you're typing here.
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HighlightTextareaHandle>(null);
  // Only re-sync when the server copy changes, not on every local edit.
  /* oxlint-disable react/exhaustive-effect-dependencies, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (save.isDirty()) return;
    // Typing in the AI panel shouldn't block edits the assistant makes to this note.
    const active = document.activeElement;
    const editing =
      active === titleRef.current ||
      (active?.tagName === "TEXTAREA" && !active.closest("[data-ai-panel]"));
    if (editing) return;
    setTitle(note.title);
    setBody(note.body);
    setTags(note.tags);
  }, [note.updatedAt]);
  /* oxlint-enable react/exhaustive-effect-dependencies, react-hooks/exhaustive-deps */

  // Find in note
  const [findOpen, setFindOpen] = useState(Boolean(q));
  const [find, setFind] = useState(() => initialFind(note.body, q));
  const [active, setActive] = useState(0);
  const [scrollKey, setScrollKey] = useState(q ? 1 : 0);
  const findInput = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => (findOpen ? findAll(body, find) : []), [findOpen, body, find]);
  const activeIndex = matches.length ? Math.min(active, matches.length - 1) : -1;

  const openFind = useCallback(() => {
    setFindOpen(true);
    requestAnimationFrame(() => {
      findInput.current?.focus();
      findInput.current?.select();
    });
  }, []);

  function step(delta: number) {
    if (!matches.length) return;
    setActive((a) => (Math.min(a, matches.length - 1) + delta + matches.length) % matches.length);
    setScrollKey((k) => k + 1);
  }

  function closeFind() {
    setFindOpen(false);
    if (activeIndex >= 0) {
      const start = matches[activeIndex];
      bodyRef.current?.selectRange(start, start + find.length);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "f" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        openFind();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFind]);

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-8">
      {/* Toolbar */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 flex h-14 items-center gap-1 bg-background/85 px-4 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-ml-2 rounded-xl"
          aria-label="Back to notes"
        >
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <SaveIndicator state={save.state} onRetry={() => void save.flush()} />
        {!isOwner && (
          <span className="ml-2 hidden items-center rounded-md bg-secondary px-1.5 py-0.5 text-[0.7rem] font-medium text-secondary-foreground sm:inline-flex">
            Shared by {access?.ownerName ?? "someone"} ·{" "}
            {role === "edit" ? "Can edit" : "View only"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label="Find in note"
                onClick={openFind}
              >
                <Search />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Find in note · Ctrl F</TooltipContent>
          </Tooltip>
          {isOwner && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  aria-label="Share"
                  disabled={offlineReadOnly}
                  onClick={() => setShareOpen(true)}
                >
                  <Share2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
          )}
          {isOwner && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("rounded-xl", note.pinned && "text-hanko")}
                  aria-label={note.pinned ? "Unpin" : "Pin"}
                  aria-pressed={note.pinned}
                  disabled={readOnly}
                  onClick={() =>
                    void setPinned({ id: note._id, pinned: !note.pinned }).catch((err: unknown) =>
                      toast.error(mutationErrorMessage(err)),
                    )
                  }
                >
                  {note.pinned ? <PinOff /> : <Pin />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{note.pinned ? "Unpin" : "Pin to top"}</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label="More"
                disabled={offlineReadOnly}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void makeCopy()}>
                <Copy /> Make a copy
              </DropdownMenuItem>
              {isOwner && (
                <DropdownMenuItem onSelect={() => void (note.archived ? unarchive() : archive())}>
                  {note.archived ? <ArchiveRestore /> : <Archive />}
                  {note.archived ? "Unarchive" : "Archive"}
                </DropdownMenuItem>
              )}
              {!isOwner && (
                <DropdownMenuItem onSelect={() => void leaveSharedNote()}>
                  <LogOut /> Leave shared note
                </DropdownMenuItem>
              )}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete note
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {findOpen && (
          <div className="absolute inset-x-4 top-full mt-1 flex h-11 items-center gap-1 rounded-xl border bg-popover pr-1 pl-3 shadow-lg sm:inset-x-auto sm:right-8 sm:w-96">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={findInput}
              autoFocus={!q}
              value={find}
              onChange={(e) => {
                setFind(e.target.value);
                setActive(0);
                setScrollKey((k) => k + 1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  step(e.shiftKey ? -1 : 1);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  closeFind();
                }
              }}
              placeholder="Find in note"
              aria-label="Find in note"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            <span
              className="shrink-0 px-1 font-mono text-xs text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {find ? (matches.length ? `${activeIndex + 1}/${matches.length}` : "No matches") : ""}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous match"
              disabled={!matches.length}
              onClick={() => step(-1)}
            >
              <ChevronUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next match"
              disabled={!matches.length}
              onClick={() => step(1)}
            >
              <ChevronDown />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Close find" onClick={closeFind}>
              <X />
            </Button>
          </div>
        )}
      </div>

      {note.archived && isOwner && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          <Archive className="size-4 shrink-0" />
          <span className="flex-1">This note is archived.</span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={() => void unarchive()}
          >
            Unarchive
          </Button>
        </div>
      )}

      <fieldset disabled={readOnly} className="contents">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            save.queue({ title: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              bodyRef.current?.focus();
            }
          }}
          autoFocus={!note.title && !note.body}
          placeholder="Untitled"
          aria-label="Title"
          className="mt-4 w-full bg-transparent font-display text-3xl font-semibold tracking-[-0.02em] outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
        />

        <ChipInput
          className="mt-3"
          value={tags}
          prefix="#"
          onChange={(next) => {
            setTags(next);
            save.queue({ tags: next }, 0);
          }}
          placeholder={tags.length ? "Add tag" : "Add tags…"}
        />

        <HighlightTextarea
          ref={bodyRef}
          className="mt-6"
          value={body}
          onChange={(value) => {
            setBody(value);
            save.queue({ body: value });
          }}
          placeholder="Start writing…"
          matches={matches}
          matchLength={find.length}
          activeIndex={activeIndex}
          scrollKey={scrollKey}
        />
      </fieldset>

      <p className="mt-10 text-xs text-muted-foreground">
        {words} {words === 1 ? "word" : "words"} · Edited {relativeTime(note.updatedAt)}
      </p>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              “{title || "Untitled"}” will be removed from all your devices. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await navigate({ to: "/" });
                  await remove({ id: note._id });
                  toast("Note deleted");
                } catch (err) {
                  toast.error(mutationErrorMessage(err));
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isOwner && <ShareDialog noteId={note._id} open={shareOpen} onOpenChange={setShareOpen} />}
    </div>
  );
}

function mutationErrorMessage(err: unknown) {
  return err instanceof ConvexError ? String(err.data) : "Something went wrong";
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-medium text-destructive underline-offset-2 hover:underline"
      >
        Couldn't save · Retry
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
      <span
        className={cn(
          "size-1.5 rounded-full",
          state === "saving" ? "animate-pulse bg-marker-active" : "bg-emerald-500",
        )}
      />
      {state === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
