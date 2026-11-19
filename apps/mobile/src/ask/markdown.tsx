import { Fragment, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../theme";

/**
 * Just enough Markdown for assistant replies: headings, bullet and numbered
 * lists, **bold**, *italic*, `code` and [links](/library/id). Anything else
 * shows as plain text.
 */
export function Markdown({ text }: { text: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const ctx: InlineContext = {
    colors,
    onLink: (href) => {
      const route = /^\/(library|notes)\/(\w+)$/.exec(href);
      if (route) {
        // navigate, not push: from the Ask AI modal this goes back to the tabs
        // and opens the screen there instead of stacking on top of the modal.
        const [, section, id] = route;
        router.navigate(section === "library" ? `/library/${id}` : `/notes/${id}`);
      } else if (/^https?:\/\//i.test(href)) {
        void Linking.openURL(href);
      }
    },
  };
  const blocks = text.split(/\n{2,}/);

  return (
    <View style={styles.blocks}>
      {blocks.map((block, b) => (
        <View key={b} style={styles.block}>
          {block.split("\n").map((line, i) => {
            const heading = /^(#{1,6})\s+(.*)$/.exec(line);
            if (heading) {
              return (
                <Text key={i} style={[styles.heading, { color: colors.ink }]}>
                  {inline(heading[2], ctx)}
                </Text>
              );
            }
            const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
            const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
            if (bullet || numbered) {
              return (
                <View key={i} style={styles.item}>
                  <Text style={[styles.text, styles.marker, { color: colors.muted }]}>
                    {bullet ? "•" : `${numbered?.[1]}.`}
                  </Text>
                  <Text style={[styles.text, styles.flex, { color: colors.ink }]}>
                    {inline(bullet ? bullet[1] : (numbered?.[2] ?? ""), ctx)}
                  </Text>
                </View>
              );
            }
            return (
              <Text key={i} style={[styles.text, { color: colors.ink }]}>
                {inline(line, ctx)}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

type InlineContext = {
  colors: { surfaceHighlight: string; hanko: string };
  onLink: (href: string) => void;
};

const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function inline(text: string, ctx: InlineContext): ReactNode {
  const { colors } = ctx;
  const parts = text.split(
    /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g,
  );
  return parts.map((part, i) => {
    const link = LINK.exec(part);
    if (link) {
      const [, label, href] = link;
      return (
        <Text
          key={i}
          accessibilityRole="link"
          onPress={() => ctx.onLink(href)}
          style={[styles.link, { color: colors.hanko }]}
        >
          {label.replace(/\*\*|`/g, "")}
        </Text>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <Text key={i} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <Text key={i} style={[styles.code, { backgroundColor: colors.surfaceHighlight }]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (
      ((part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_"))) &&
      part.length > 2
    ) {
      return (
        <Text key={i} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const styles = StyleSheet.create({
  blocks: { gap: 10 },
  block: { gap: 4 },
  flex: { flex: 1 },
  text: { fontSize: 15, lineHeight: 23 },
  heading: { fontSize: 16, lineHeight: 23, fontWeight: "600" },
  item: { flexDirection: "row", gap: 8, paddingLeft: 2 },
  marker: { minWidth: 14 },
  bold: { fontWeight: "600" },
  link: { fontWeight: "500", textDecorationLine: "underline" },
  italic: { fontStyle: "italic" },
  code: { fontFamily: "monospace", fontSize: 13 },
});
