import { useSmoothText, useUIMessages, type UIMessage } from "@convex-dev/agent/react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowUp,
  BookOpen,
  FilePen,
  FilePlus,
  FileText,
  Library,
  LibraryBig,
  ListChecks,
  LoaderCircle,
  Search,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Markdown } from "#/components/ask/markdown";
import { Bubble, BubbleContent } from "#/components/ui/bubble";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "#/components/ui/input-group";
import { Message, MessageContent } from "#/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "#/components/ui/message-scroller";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "#/components/ui/trace";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { PageRef } from "../../../convex/validators";

/** The page the user has open, offered to the assistant as context. */
export type CurrentPage = PageRef & { title: string };

const GENERAL_PROMPTS = [
  "read btth up to 352",
  "what did I note about cultivation ranks?",
  "what am I reading right now?",
  "find my notes about favorite characters",
];
const NOTE_PROMPTS = ["Summarize this note", "Suggest tags for this note", "Tidy this note into a list", "What else did I write about this?"];
const SERIES_PROMPTS = ["Bump this to the next chapter", "Mark this as completed", "What did I note about this series?"];

/** How each assistant tool reads in the UI: while running, and once done. */
const TOOLS: Record<string, { icon: LucideIcon; running: string; done: string }> = {
  search: { icon: Search, running: "Searching your notes", done: "Searched your notes" },
  listLibrary: { icon: LibraryBig, running: "Checking your Library", done: "Checked your Library" },
  readNote: { icon: BookOpen, running: "Reading a note", done: "Read a note" },
  updateChapter: { icon: ListChecks, running: "Updating the chapter", done: "Updated the chapter" },
  addSeries: { icon: Library, running: "Adding the series", done: "Added the series" },
  createNote: { icon: FilePlus, running: "Creating a note", done: "Created a note" },
  appendToNote: { icon: FilePen, running: "Adding to the note", done: "Added to the note" },
  updateNote: { icon: FilePen, running: "Editing the note", done: "Edited the note" },
  updateSeries: { icon: Library, running: "Updating the series", done: "Updated the series" },
};
const toolInfo = (name: string) => TOOLS[name] ?? { icon: Wrench, running: "Working", done: "Used a tool" };

type ToolPart = { name: string; state?: string; input?: unknown; output?: unknown; errorText?: string };

function toolParts(message: UIMessage): ToolPart[] {
  return message.parts.flatMap((part) => {
    if (part.type === "dynamic-tool") return [{ name: part.toolName, ...pick(part) }];
    if (part.type.startsWith("tool-")) return [{ name: part.type.slice(5), ...pick(part) }];
    return [];
  });
}
function pick(part: object): Omit<ToolPart, "name"> {
  const p = part as Partial<ToolPart>;
  return { state: p.state, input: p.input, output: p.output, errorText: p.errorText };
}
const isDone = (state?: string) => state === "output-available" || state === "output-error";

/**
 * What the assistant is doing right now, for the status line under the prompt,
 * or null when it's idle.
 */
function activity(messages: UIMessage[], sending: boolean): string | null {
  const last = messages.at(-1);
  if (sending || last?.role === "user") return "Thinking";
  if (!last || last.role !== "assistant" || (last.status !== "streaming" && last.status !== "pending")) return null;
  const running = toolParts(last).filter((t) => !isDone(t.state)).pop();
  if (running) return toolInfo(running.name).running;
  return last.text ? "Writing a reply" : "Thinking";
}

/** Seconds since `active` became true; resets when it goes false. */
function useElapsed(active: boolean) {
  const [start, setStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      setStart(null);
      return;
    }
    setStart(Date.now());
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return start === null ? 0 : Math.max(0, Math.floor((now - start) / 1000));
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * Messages and composer for one chat thread. With no threadId, the first
 * message starts a thread and reports it through onThread.
 */
export function Conversation({
  threadId,
  onThread,
  page,
  compact = false,
}: {
  threadId: string | undefined;
  onThread: (threadId: string) => void;
  page?: CurrentPage | null;
  compact?: boolean;
}) {
  const send = useMutation(api.chat.send);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  // Page context is on by default and comes back whenever the page changes.
  const [usePage, setUsePage] = useState(true);
  const pageKey = page ? `${page.kind}:${page.id}` : "";
  useEffect(() => setUsePage(true), [pageKey]);
  const attached = usePage && page ? page : null;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { results: messages, status, loadMore } = useUIMessages(
    api.chat.messages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 30, stream: true },
  );
  const working = activity(messages, sending);
  const elapsed = useElapsed(working !== null);

  async function submit(event?: FormEvent, text = prompt.trim()) {
    event?.preventDefault();
    if (!text || sending) return;
    setSending(true);
    try {
      const id = await send({
        prompt: text,
        ...(threadId ? { threadId } : {}),
        ...(attached ? { page: { kind: attached.kind, id: attached.id } as PageRef } : {}),
      });
      setPrompt("");
      if (id !== threadId) onThread(id);
    } catch (error) {
      toast.error("Couldn't send", { description: errorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  const suggestions = attached?.kind === "note" ? NOTE_PROMPTS : attached?.kind === "series" ? SERIES_PROMPTS : GENERAL_PROMPTS;
  const pad = compact ? "px-4" : "px-4 sm:px-6";

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      {threadId && !messages.length && status === "LoadingFirstPage" ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <LoaderCircle className="mr-2 size-4 animate-spin" /> Loading chat…
        </div>
      ) : messages.length === 0 ? (
        <div className={cn("min-h-0 flex-1 overflow-y-auto py-5", pad)}>
          <EmptyConversation
            compact={compact}
            prompts={suggestions}
            onPrompt={(text) => {
              // Page-specific prompts are complete requests; send them right away.
              if (attached) void submit(undefined, text);
              else {
                setPrompt(text);
                inputRef.current?.focus();
              }
            }}
          />
        </div>
      ) : (
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport aria-label="Conversation">
              <MessageScrollerContent aria-busy={working !== null} className={cn("mx-auto w-full max-w-3xl gap-6 py-5", pad)}>
                {status === "CanLoadMore" && (
                  <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={() => loadMore(30)}>
                    Load earlier messages
                  </Button>
                )}
                {messages.map((message) => (
                  <MessageScrollerItem key={message.key} messageId={message.key} scrollAnchor={message.role === "user"}>
                    <ChatMessage message={message} />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <form onSubmit={submit} className={cn("shrink-0 pt-2", compact ? "px-3 pb-3" : "px-3 pb-3 sm:px-4 sm:pb-4")}>
        <div className="mx-auto max-w-3xl">
          <InputGroup
            className={cn(
              "rounded-2xl bg-card shadow-sm dark:bg-card",
              working !== null && "prompt-glow",
            )}
          >
            <InputGroupTextarea
              ref={inputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={attached ? `Ask about this ${attached.kind === "note" ? "note" : "series"}…` : "Ask about your notes or Library…"}
              aria-label="Message"
              rows={1}
              maxLength={4000}
              className="max-h-40 min-h-11 px-3.5 text-base md:text-sm"
            />
            <InputGroupAddon align="block-end" className="gap-1.5 pt-0">
              {page &&
                (attached ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border bg-background py-0.5 pr-0.5 pl-2 text-xs font-normal">
                    {page.kind === "note" ? <FileText className="size-3.5 shrink-0" /> : <Library className="size-3.5 shrink-0" />}
                    <span className="max-w-48 truncate">
                      <span className="sr-only">Using this page: </span>
                      {page.title || "Untitled"}
                    </span>
                    <InputGroupButton size="icon-xs" aria-label="Don't use this page" onClick={() => setUsePage(false)} className="rounded-full">
                      <X />
                    </InputGroupButton>
                  </span>
                ) : (
                  <InputGroupButton size="xs" onClick={() => setUsePage(true)} className="rounded-full border border-dashed font-normal">
                    + Use this page
                  </InputGroupButton>
                ))}
              <InputGroupButton
                type="submit"
                size="icon-sm"
                variant="hanko"
                aria-label="Send message"
                disabled={!prompt.trim() || sending}
                className="ml-auto rounded-xl"
              >
                {sending ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          {/* Status line: what the assistant is doing, with a shimmer, like a live caption. */}
          <div className="mt-2 flex h-5 items-center gap-1.5 px-1 text-xs" aria-live="polite">
            {working ? (
              <>
                <Sparkles className="size-3.5 shrink-0 animate-pulse text-muted-foreground" aria-hidden />
                <span className="shimmer font-medium">{working}…</span>
                {elapsed >= 2 && <span className="tabular-nums text-muted-foreground">· {formatElapsed(elapsed)}</span>}
              </>
            ) : (
              !compact && <span className="text-muted-foreground">Enter to send · Shift + Enter for a new line</span>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

function EmptyConversation({
  prompts,
  onPrompt,
  compact,
}: {
  prompts: string[];
  onPrompt: (prompt: string) => void;
  compact: boolean;
}) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-8 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
        <Sparkles className="size-5" />
      </div>
      <h2 className={cn("mt-4 font-display font-semibold", compact ? "text-lg" : "text-xl")}>What would you like to do?</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Ask about your notes, update a chapter, or look something up.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {prompts.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPrompt(example)}
            className="rounded-full border bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="secondary">
            <BubbleContent className="rounded-2xl px-4 py-2.5 whitespace-pre-wrap">{message.text}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }

  const streaming = message.status === "streaming" || message.status === "pending";
  const tools = toolParts(message);
  return (
    <Message>
      <MessageContent className="gap-3">
        {tools.length > 0 && (
          <Trace>
            {tools.map((tool, i) => (
              <ToolStep key={`${message.key}-tool-${i}`} tool={tool} streaming={streaming} />
            ))}
          </Trace>
        )}
        {message.parts.map((part, i) =>
          part.type === "text" && part.text ? (
            <div key={`${message.key}-${i}`} className="text-sm leading-7 text-foreground">
              <SmoothPart text={part.text} streaming={streaming} />
            </div>
          ) : null,
        )}
        {message.status === "failed" && <p className="text-sm text-destructive">The assistant couldn't finish this reply. Try again.</p>}
      </MessageContent>
    </Message>
  );
}

/** One tool call: a shimmering line while it runs, then a line you can open to see what it did. */
function ToolStep({ tool, streaming }: { tool: ToolPart; streaming: boolean }) {
  const info = toolInfo(tool.name);
  const Icon = info.icon;
  const failed = tool.state === "output-error";

  if (!isDone(tool.state)) {
    return (
      <TraceLine status={streaming ? "running" : "error"}>
        <TraceIcon>
          <Icon />
        </TraceIcon>
        <TraceTitle>{streaming ? `${info.running}…` : `Couldn't finish: ${info.running.toLowerCase()}`}</TraceTitle>
      </TraceLine>
    );
  }

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={failed ? "error" : undefined}>
          <TraceIcon>
            <Icon />
          </TraceIcon>
          <TraceTitle>{failed ? `Failed: ${info.running.toLowerCase()}` : info.done}</TraceTitle>
          {summary(tool) && <span className="truncate text-xs text-muted-foreground/80">{summary(tool)}</span>}
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <pre className="max-h-56 overflow-auto rounded-lg bg-muted/60 p-2.5 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
          {failed ? tool.errorText : JSON.stringify(tool.output, null, 2)}
        </pre>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

/** A few words on the collapsed line, e.g. the search query or "348 → 352". */
function summary(tool: ToolPart): string | null {
  const input = (tool.input ?? {}) as Record<string, unknown>;
  const output = (tool.output ?? {}) as Record<string, unknown>;
  if (typeof output.error === "string") return output.error;
  switch (tool.name) {
    case "search":
      return typeof input.query === "string" ? `“${input.query}”` : null;
    case "updateChapter":
      return typeof output.title === "string" ? `${output.title}: ${output.from} → ${output.to}` : null;
    case "listLibrary":
      return Array.isArray(tool.output) ? `${tool.output.length} series` : null;
    default:
      return typeof output.title === "string" ? output.title : null;
  }
}

function SmoothPart({ text, streaming }: { text: string; streaming: boolean }) {
  const [visibleText] = useSmoothText(text, { startStreaming: streaming });
  return <Markdown text={visibleText} />;
}

export function errorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  return error instanceof Error ? error.message : "Please try again.";
}
