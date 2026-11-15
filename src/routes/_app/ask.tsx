import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChartColumn, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Conversation, errorMessage } from "#/components/ask/conversation";
import { UsageView } from "#/components/ask/usage-view";
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
import { pageTitle } from "#/lib/seo";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/_app/ask")({
  head: () => ({ meta: [{ title: pageTitle("Ask") }] }),
  validateSearch: (search: Record<string, unknown>): { threadId?: string; tab?: "usage" } => ({
    ...(typeof search.threadId === "string" && search.threadId
      ? { threadId: search.threadId }
      : {}),
    ...(search.tab === "usage" ? { tab: "usage" as const } : {}),
  }),
  component: AskPage,
});

function AskPage() {
  const { threadId, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const status = useQuery(api.chat.status, {});
  const threads = useQuery(api.chat.threads, {});
  const remove = useMutation(api.chat.remove);
  const [deletingThread, setDeletingThread] = useState<{ id: string; title: string } | null>(null);

  async function deleteThread() {
    if (!deletingThread) return;
    const id = deletingThread.id;
    try {
      await remove({ threadId: id });
      setDeletingThread(null);
      if (threadId === id) await navigate({ search: {} });
      toast("Chat deleted");
    } catch (error) {
      toast.error("Couldn't delete chat", { description: errorMessage(error) });
    }
  }

  if (status?.enabled === false) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
        <h1 className="font-display text-3xl font-semibold">Ask</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The assistant isn't available right now.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-10.5rem-env(safe-area-inset-bottom))] min-h-[24rem] max-w-6xl flex-col px-4 py-4 sm:px-8 sm:py-6 lg:h-dvh lg:min-h-0">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Ask</h1>
          <div
            role="tablist"
            aria-label="Ask"
            className="inline-flex rounded-xl border bg-card p-0.5"
          >
            <TabButton
              active={tab !== "usage"}
              onClick={() => void navigate({ search: threadId ? { threadId } : {} })}
            >
              <MessageCircle /> Chats
            </TabButton>
            <TabButton
              active={tab === "usage"}
              onClick={() => void navigate({ search: { tab: "usage" } })}
            >
              <ChartColumn /> Usage
            </TabButton>
          </div>
        </div>
        {tab !== "usage" && (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => void navigate({ search: {} })}
          >
            <Plus /> <span className="hidden sm:inline">New chat</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </div>

      {tab === "usage" ? (
        <div
          role="tabpanel"
          aria-label="Usage"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card"
        >
          <UsageView />
        </div>
      ) : (
        <div
          role="tabpanel"
          aria-label="Chats"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card sm:flex-row"
        >
          <ThreadList
            threads={threads ?? []}
            activeThreadId={threadId}
            onSelect={(id) => void navigate({ search: { threadId: id } })}
            onDelete={setDeletingThread}
          />
          <Conversation
            key={threadId ?? "new"}
            threadId={threadId}
            onThread={(id) => void navigate({ search: { threadId: id } })}
          />
        </div>
      )}

      <AlertDialog
        open={deletingThread !== null}
        onOpenChange={(open) => !open && setDeletingThread(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingThread?.title}” and its messages will be deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void deleteThread();
              }}
            >
              Delete chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ThreadList({
  threads,
  activeThreadId,
  onSelect,
  onDelete,
}: {
  threads: { id: string; title: string; createdAt: number }[];
  activeThreadId?: string;
  onSelect: (id: string) => void;
  onDelete: (thread: { id: string; title: string }) => void;
}) {
  return (
    <aside
      aria-label="Chat history"
      className="flex max-h-28 shrink-0 gap-1 overflow-x-auto border-b p-2 sm:max-h-none sm:w-60 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:border-r sm:border-b-0 sm:p-3"
    >
      {threads.map((thread) => (
        <div key={thread.id} className="group flex min-w-0 shrink-0 items-center sm:w-full">
          <button
            type="button"
            onClick={() => onSelect(thread.id)}
            aria-current={activeThreadId === thread.id ? "page" : undefined}
            title={thread.title}
            className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-accent sm:w-full ${
              activeThreadId === thread.id
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <MessageCircle className="size-4 shrink-0" />
            <span className="max-w-40 truncate sm:max-w-none">{thread.title}</span>
          </button>
          <button
            type="button"
            aria-label={`Delete ${thread.title}`}
            onClick={() => onDelete({ id: thread.id, title: thread.title })}
            className="ml-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-70 transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      {threads.length === 0 && (
        <p className="px-2.5 py-2 text-xs text-muted-foreground">Your chats will show here.</p>
      )}
    </aside>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&>svg]:size-4",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}
