import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";
import { useTheme } from "../theme";
import { termsRegex } from "./snippet";

export function HighlightedText({
  text,
  terms,
  style,
  numberOfLines,
}: {
  text: string;
  terms: string[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const regex = termsRegex(terms);

  if (!regex) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const parts = text.split(regex);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text
            key={i}
            style={{
              backgroundColor: colors.marker,
              color: colors.ink,
              fontWeight: "600",
            }}
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
