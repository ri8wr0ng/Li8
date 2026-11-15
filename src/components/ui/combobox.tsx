import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "#/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { cn } from "#/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Options with the same group are listed together under that heading. */
  group?: string;
};

/** A shortcut row above the options, e.g. "All reading" that toggles a set at once. */
export type ComboboxPreset = { label: string; values: string[] };

type CommonProps = {
  options: ComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Offer "Create “…”" when the search matches nothing exactly. Resolves to the new option's value. */
  onCreate?: (name: string) => Promise<string | undefined> | string | undefined;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  /** Replaces the default trigger contents (the selected labels). */
  children?: ReactNode;
  "aria-label"?: string;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: string | undefined;
  onChange: (value: string) => void;
};

type MultipleProps = CommonProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  presets?: ComboboxPreset[];
};

/**
 * A searchable picker. Single mode closes on pick; multiple mode stays open so
 * several options can be toggled in a row.
 */
export function Combobox(props: SingleProps | MultipleProps) {
  const {
    options,
    placeholder,
    searchPlaceholder = "Search…",
    emptyText = "Nothing found.",
    onCreate,
    disabled,
    className,
    contentClassName,
    align = "start",
    children,
  } = props;
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [search, setSearch] = useState("");

  const selected = props.multiple ? props.value : props.value === undefined ? [] : [props.value];
  const isSelected = (value: string) => selected.includes(value);

  const pick = (value: string) => {
    if (props.multiple) {
      props.onChange(
        isSelected(value) ? props.value.filter((v) => v !== value) : [...props.value, value],
      );
    } else {
      props.onChange(value);
      setOpen(false);
    }
  };

  const togglePreset = (preset: ComboboxPreset) => {
    if (!props.multiple) return;
    const all = preset.values.every(isSelected);
    props.onChange(
      all
        ? props.value.filter((v) => !preset.values.includes(v))
        : [...new Set([...props.value, ...preset.values])],
    );
  };

  const trimmed = search.trim();
  const canCreate =
    onCreate !== undefined &&
    trimmed.length > 0 &&
    !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  const create = async () => {
    if (!onCreate) return;
    const value = await onCreate(trimmed);
    setSearch("");
    if (value === undefined) return;
    if (props.multiple) {
      if (!props.value.includes(value)) props.onChange([...props.value, value]);
    } else {
      props.onChange(value);
      setOpen(false);
    }
  };

  // Keep the caller's order, bucketed by group.
  const groups = new Map<string, ComboboxOption[]>();
  for (const option of options) {
    const key = option.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }

  const labels = options.filter((o) => isSelected(o.value)).map((o) => o.label);
  const summary =
    labels.length === 0
      ? null
      : labels.length <= 2
        ? labels.join(", ")
        : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      modal
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={props["aria-label"]}
          className={cn(
            "flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          {children ?? (
            <span className={cn("min-w-0 truncate", !summary && "text-muted-foreground")}>
              {summary ?? placeholder}
            </span>
          )}
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        align={align}
        className={cn("w-(--radix-popover-trigger-width) min-w-56 p-0", contentClassName)}
      >
        {/* Match on the visible label only; values are ids. */}
        <Command filter={matchKeywords}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72">
            {!canCreate && <CommandEmpty>{emptyText}</CommandEmpty>}
            {props.multiple && props.presets && props.presets.length > 0 && (
              <>
                <CommandGroup>
                  {props.presets.map((preset) => (
                    <CommandItem
                      key={preset.label}
                      value={`preset:${preset.label}`}
                      keywords={[preset.label]}
                      onSelect={() => togglePreset(preset)}
                    >
                      <Check on={preset.values.every(isSelected)} />
                      {preset.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {[...groups].map(([group, items]) => (
              <CommandGroup key={group} heading={group || undefined}>
                {items.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    onSelect={() => pick(option.value)}
                  >
                    <Check on={isSelected(option.value)} />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {canCreate && (
              <CommandGroup forceMount>
                <CommandItem value={`create:${trimmed}`} forceMount onSelect={() => void create()}>
                  <PlusIcon />
                  Create “{trimmed}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function matchKeywords(_value: string, search: string, keywords?: string[]) {
  const haystack = (keywords ?? []).join(" ").toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term))
    ? 1
    : 0;
}

function Check({ on }: { on: boolean }) {
  return <CheckIcon className={cn("text-foreground!", on ? "opacity-100" : "opacity-0")} />;
}
