import {
  Extension,
  getHTMLFromFragment,
  getSchema,
  type AnyExtension,
  type JSONContent,
} from "@tiptap/core";
import { Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Heading } from "@tiptap/extension-heading";
import { Paragraph } from "@tiptap/extension-paragraph";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Link } from "@tiptap/extension-link";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { StarterKit } from "@tiptap/starter-kit";
import { FindHighlight } from "./find";
import { UndoGrouping } from "./undo-grouping";

export const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];
const ALIGNED_TYPES = ["paragraph", "heading"];

function isAlignment(value: unknown): value is Alignment {
  return typeof value === "string" && (ALIGNMENTS as readonly string[]).includes(value);
}

/**
 * `textAlign` on paragraphs and headings. Read from `align="…"` (what GitHub READMEs use) or
 * `style="text-align: …"`, and written back as `align`, so a note stays readable on GitHub.
 */
const TextAlign = Extension.create({
  name: "textAlign",
  addGlobalAttributes() {
    return [
      {
        types: ALIGNED_TYPES,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => {
              const value = element.getAttribute("align") ?? element.style.textAlign;
              return isAlignment(value) && value !== "left" ? value : null;
            },
            renderHTML: (attributes) =>
              isAlignment(attributes.textAlign) ? { align: attributes.textAlign } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextAlign:
        (alignment: Alignment) =>
        ({ commands }) => {
          const value = alignment === "left" ? null : alignment;
          return ALIGNED_TYPES.map((type) =>
            commands.updateAttributes(type, { textAlign: value }),
          ).some(Boolean);
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-l": () => this.editor.commands.setTextAlign("left"),
      "Mod-Shift-e": () => this.editor.commands.setTextAlign("center"),
      "Mod-Shift-r": () => this.editor.commands.setTextAlign("right"),
      "Mod-Shift-j": () => this.editor.commands.setTextAlign("justify"),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textAlign: { setTextAlign: (alignment: Alignment) => ReturnType };
  }
}

/**
 * Markdown has no alignment, so an aligned block is written as GitHub-style HTML:
 * `<p align="center">…</p>`. Inside an HTML block GitHub ignores Markdown, so the inline content is
 * HTML too (`<strong>`, `<a>`), and the Markdown parser reads it back through the editor schema.
 */
function alignedHtml(node: JSONContent, tag: string, extensions: AnyExtension[]): string | null {
  const align = node.attrs?.textAlign;
  if (!isAlignment(align) || align === "left") return null;
  let inner: string;
  try {
    const schema = getSchemaCached(extensions);
    inner = getHTMLFromFragment(PMNode.fromJSON(schema, node).content, schema);
  } catch {
    inner = "";
  }
  return `<${tag} align="${align}">${inner}</${tag}>`;
}

let cachedSchema: { key: AnyExtension[]; schema: Schema } | null = null;
function getSchemaCached(extensions: AnyExtension[]) {
  if (cachedSchema?.key !== extensions) {
    cachedSchema = { key: extensions, schema: getSchema(extensions) };
  }
  return cachedSchema.schema;
}

/** Filled in by `noteExtensions` so aligned blocks can render their HTML with the full schema. */
const schemaExtensions: { current: AnyExtension[] } = { current: [] };

const AlignedParagraph = Paragraph.extend({
  renderMarkdown(node, helpers, ctx) {
    return (
      alignedHtml(node, "p", schemaExtensions.current) ??
      this.parent?.(node, helpers, ctx) ??
      helpers.renderChildren(node.content ?? [])
    );
  },
});

const AlignedHeading = Heading.extend({
  renderMarkdown(node, helpers, ctx) {
    const level = typeof node.attrs?.level === "number" ? node.attrs.level : 1;
    return (
      alignedHtml(node, `h${level}`, schemaExtensions.current) ??
      this.parent?.(node, helpers, ctx) ??
      ""
    );
  },
});

/** Typing right after a link shouldn't extend it (autolink would otherwise make it inclusive). */
const NoteLink = Link.extend({ inclusive: () => false });

/** Plain notes use single newlines as line breaks; `breaks: true` reads them, this writes them. */
const LineBreak = HardBreak.extend({
  renderMarkdown: () => "\n",
});

export type NoteExtensionOptions = {
  placeholder?: string;
};

/** Everything the note editor understands. The same list on web, in the mobile WebView, and in tests. */
export function noteExtensions(options: NoteExtensionOptions = {}): AnyExtension[] {
  const extensions: AnyExtension[] = [
    StarterKit.configure({
      paragraph: false,
      heading: false,
      hardBreak: false,
      link: false,
    }),
    NoteLink.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    }),
    AlignedParagraph,
    AlignedHeading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    LineBreak,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign,
    FindHighlight,
    UndoGrouping,
    Markdown.configure({
      markedOptions: { gfm: true, breaks: true },
    }),
  ];
  if (options.placeholder) {
    extensions.push(Placeholder.configure({ placeholder: options.placeholder }));
  }
  schemaExtensions.current = extensions;
  return extensions;
}
