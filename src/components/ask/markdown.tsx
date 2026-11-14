import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Link labels may contain one level of brackets, e.g. "[[AI test] Ranks](/notes/…)".
const INLINE_PATTERN =
  /\[((?:[^[\]]|\[[^[\]]*\])+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(?<![\w*])[*_]([^*_\n]+)[*_](?![\w*])/g;

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let orderedList = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {paragraph.map((line, index) => (
          <span key={index}>
            {index > 0 && <br />}
            {inline(line)}
          </span>
        ))}
      </p>,
    );
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    const List = orderedList ? "ol" : "ul";
    blocks.push(
      <List
        key={`list-${blocks.length}`}
        className={`my-2 space-y-1 pl-5 ${orderedList ? "list-decimal" : "list-disc"}`}
      >
        {list.map((line, index) => (
          <li key={index}>{inline(line.replace(/^\s*(?:[-*]\s+|\d+\.\s+)/, ""))}</li>
        ))}
      </List>,
    );
    list = [];
  }

  lines.forEach((line) => {
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (/^\s*(?:[-*]\s+|\d+\.\s+)/.test(line)) {
      flushParagraph();
      const isOrdered = /^\s*\d+\.\s+/.test(line);
      if (list.length && orderedList !== isOrdered) flushList();
      orderedList = isOrdered;
      list.push(line);
    } else {
      flushList();
      paragraph.push(line);
    }
  });
  flushParagraph();
  flushList();

  return <div className="space-y-2 break-words">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) result.push(text.slice(lastIndex, index));
    const [, label, href, bold, code, italic] = match;
    if (label !== undefined && href !== undefined) {
      result.push(internalLink(label, href, `l-${index}`));
    } else if (bold !== undefined) {
      result.push(
        <strong key={`b-${index}`} className="font-semibold">
          {bold}
        </strong>,
      );
    } else if (italic !== undefined) {
      result.push(<em key={`i-${index}`}>{italic}</em>);
    } else if (code !== undefined) {
      result.push(
        <code
          key={`c-${index}`}
          className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.9em]"
        >
          {code}
        </code>,
      );
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

function internalLink(label: string, href: string, key: string) {
  const note = /^\/notes\/([^/?#]+)$/.exec(href);
  if (note) {
    return (
      <Link
        key={key}
        to="/notes/$noteId"
        params={{ noteId: note[1] }}
        className="font-medium text-primary underline underline-offset-2"
      >
        {label}
      </Link>
    );
  }
  const series = /^\/library\/([^/?#]+)$/.exec(href);
  if (series) {
    return (
      <Link
        key={key}
        to="/library/$seriesId"
        params={{ seriesId: series[1] }}
        className="font-medium text-primary underline underline-offset-2"
      >
        {label}
      </Link>
    );
  }
  return label;
}
