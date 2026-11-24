import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FileQuestion } from "lucide-react";
import { Wordmark } from "#/components/brand";
import { NoteViewer } from "#/components/note-editor";
import { EmptyState } from "#/components/page";
import { Skeleton } from "#/components/ui/skeleton";
import { pageTitle, useDocumentTitle } from "#/lib/seo";
import { relativeTime } from "#/lib/time";
import { api } from "@inkmark/backend/convex/_generated/api";

export const Route = createFileRoute("/s/$publicId")({
  head: () => ({
    meta: [{ title: pageTitle("Shared note") }, { name: "robots", content: "noindex" }],
  }),
  component: SharedNotePage,
});

function SharedNotePage() {
  const { publicId } = Route.useParams();
  const note = useQuery(api.notes.getPublic, { publicId });
  useDocumentTitle(note?.title || undefined);

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 sm:px-10">
      <header className="py-6 sm:py-8">
        <Link to="/login" className="inline-flex rounded-md" aria-label="li8 home">
          <Wordmark />
        </Link>
      </header>
      <main className="flex-1 py-8">
        {note === undefined ? (
          <div>
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="mt-6 h-4 w-full" />
          </div>
        ) : note === null ? (
          <EmptyState icon={<FileQuestion />} title="This link doesn't work">
            The note may have been deleted, or its owner turned off the link.
          </EmptyState>
        ) : (
          <>
            <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
              {note.title || "Untitled"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {note.ownerName ? `Shared by ${note.ownerName} · ` : ""}Updated{" "}
              {relativeTime(note.updatedAt)}
            </p>
            {note.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.7rem] font-medium text-secondary-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <NoteViewer markdown={note.body} className="mt-8" />
          </>
        )}
      </main>
      <footer className="border-t py-6 text-sm text-muted-foreground">
        Written in li8 ·{" "}
        <Link to="/login" className="underline">
          Start your own notes
        </Link>
      </footer>
    </div>
  );
}
