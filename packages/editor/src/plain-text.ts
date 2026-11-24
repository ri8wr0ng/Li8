/** Convert the Markdown stored by the editor into text suitable for search and previews. */
export function markdownToPlainText(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let fence: "```" | "~~~" | null = null;

  for (const originalLine of lines) {
    const fenceMarker = originalLine.match(/^\s*(```|~~~)/)?.[1];
    if (fenceMarker === "```" || fenceMarker === "~~~") {
      if (fence === null) fence = fenceMarker;
      else if (fenceMarker === fence) fence = null;
      continue;
    }

    // Code is content, not Markdown syntax; preserve it exactly between fence lines.
    if (fence !== null) {
      output.push(originalLine);
      continue;
    }

    let line = originalLine;
    line = line.replace(/^(?:\s*>\s*)+/, "");
    line = line.replace(/^\s{0,3}#{1,6}\s+/, "");
    line = line.replace(/^\s*(?:-\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/, "");

    if (/^\s*(?:(?:-{3,})|(?:\*{3,})|(?:_{3,}))\s*$/.test(line)) continue;

    line = line.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
    line = line.replace(/(`+)(.*?)\1/g, "$2");
    line = line.replace(/\*\*(.+?)\*\*/g, "$1");
    line = line.replace(/__(.+?)__/g, "$1");
    line = line.replace(/~~(.+?)~~/g, "$1");
    line = line.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
    line = line.replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "$1");
    line = line.replace(/<[^>]*>/g, "");
    line = line.replace(/&nbsp;/gi, " ");
    line = line.replace(/&amp;/gi, "&");
    line = line.replace(/&lt;/gi, "<");
    line = line.replace(/&gt;/gi, ">");
    line = line.replace(/&quot;/gi, '"');
    line = line.replace(/&#39;/gi, "'");
    output.push(line);
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
