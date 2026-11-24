import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileText,
  Link2,
  LogOut,
  Pin,
  PinOff,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "#/components/ui/context-menu";
import { api } from "@inkmark/backend/convex/_generated/api";
import type { Doc, Id } from "@inkmark/backend/convex/_generated/dataModel";

function mutationErrorMessage(err: unknown) {
  return err instanceof ConvexError ? String(err.data) : "Something went wrong";
}

export function NoteRowMenu({
  note,
  children,
  query,
  isOwner,
  userId,
}: {
  note: Doc<"notes">;
  children: ReactNode;
  query?: string;
  isOwner: boolean;
  userId?: Id<"users">;
}) {
  const navigate = useNavigate();
  const update = useMutation(api.notes.update);
  const duplicate = useMutation(api.notes.duplicate);
  const setArchived = useMutation(api.notes.setArchived);
  const unshare = useMutation(api.notes.unshare);
  const remove = useMutation(api.notes.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const open = () =>
    navigate({
      to: "/notes/$noteId",
      params: { noteId: note._id },
      search: query ? { q: query } : {},
    });
  async function archive() {
    try {
      await setArchived({ id: note._id, archived: true });
      toast("Note archived", {
        action: {
          label: "Undo",
          onClick: () =>
            void setArchived({ id: note._id, archived: false }).catch((err: unknown) =>
              toast.error(mutationErrorMessage(err)),
            ),
        },
      });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }
  async function restore() {
    try {
      await setArchived({ id: note._id, archived: false });
      toast("Note restored");
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }
  async function copy() {
    try {
      const id = await duplicate({ id: note._id });
      toast("Copy made");
      await navigate({ to: "/notes/$noteId", params: { noteId: id } });
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }
  async function leave() {
    if (!userId) return;
    try {
      await unshare({ id: note._id, userId });
      toast("Removed from your shared notes");
    } catch (err) {
      toast.error(mutationErrorMessage(err));
    }
  }
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => void open()}>
            <FileText /> Open
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => window.open(`/notes/${note._id}`, "_blank", "noopener")}>
            <SquareArrowOutUpRight /> Open in new tab
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => {
              void navigator.clipboard.writeText(`${location.origin}/notes/${note._id}`);
              toast("Link copied");
            }}
          >
            <Link2 /> Copy link
          </ContextMenuItem>
          <ContextMenuSeparator />
          {isOwner && !note.archived && (
            <ContextMenuItem
              onSelect={() =>
                void update({ id: note._id, pinned: !note.pinned }).catch((err: unknown) =>
                  toast.error(mutationErrorMessage(err)),
                )
              }
            >
              {note.pinned ? <PinOff /> : <Pin />} {note.pinned ? "Unpin" : "Pin to top"}
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => void copy()}>
            <Copy /> Make a copy
          </ContextMenuItem>
          {isOwner ? (
            <ContextMenuItem onSelect={() => void (note.archived ? restore() : archive())}>
              {note.archived ? <ArchiveRestore /> : <Archive />}{" "}
              {note.archived ? "Restore" : "Archive"}
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onSelect={() => void leave()}>
              <LogOut /> Remove from shared
            </ContextMenuItem>
          )}
          {isOwner && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete…
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              “{note.title || "Untitled"}” will be removed from all your devices. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
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
    </>
  );
}
