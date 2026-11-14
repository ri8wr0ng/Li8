import { Search, X } from "lucide-react";
import { forwardRef, useEffect, useRef, type ReactNode } from "react";
import { cn } from "#/lib/utils";

export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {title}
        </h1>
        {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Search input. Press "/" anywhere on the page to focus it. */
export const SearchField = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (value: string) => void; placeholder: string; className?: string }
>(function SearchField({ value, onChange, placeholder, className }, forwarded) {
  const local = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable=true]")) return;
      e.preventDefault();
      local.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label
      className={cn(
        "flex h-11 items-center gap-2.5 rounded-xl border bg-card px-3.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={(node) => {
          local.current = node;
          if (typeof forwarded === "function") forwarded(node);
          else if (forwarded) forwarded.current = node;
        }}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="hidden rounded border bg-background px-1.5 font-mono text-[0.7rem] text-muted-foreground sm:block">
          /
        </kbd>
      )}
    </label>
  );
});

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground [&>svg]:size-5">
        {icon}
      </div>
      <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
      {children && (
        <div className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">{children}</div>
      )}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 px-1 text-[0.7rem] font-medium tracking-widest text-muted-foreground uppercase">
      {children}
    </h2>
  );
}
