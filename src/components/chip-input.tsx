import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/utils";

/** A list of short strings (tags, alternative names, genres). Enter or comma adds one. */
export function ChipInput({
  value,
  onChange,
  placeholder,
  prefix,
  className,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  prefix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string = draft) {
    const items = raw
      .split(",")
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean);
    setDraft("");
    const next = [...value];
    for (const item of items) {
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item);
    }
    if (next.length !== value.length) onChange(next);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {value.map((item) => (
        <span
          key={item}
          className="inline-flex h-7 items-center gap-1 rounded-lg bg-secondary pr-1 pl-2 text-sm text-secondary-foreground"
        >
          {prefix}
          {item}
          <button
            type="button"
            aria-label={`Remove ${item}`}
            onClick={() => onChange(value.filter((v) => v !== item))}
            className="grid size-5 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          if (e.target.value.includes(",")) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit()}
        placeholder={placeholder}
        className="h-7 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/80"
      />
    </div>
  );
}
