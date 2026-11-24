import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme";

export function ChipInput({
  value,
  onChange,
  placeholder,
  prefix = "#",
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  prefix?: string;
}) {
  const { colors, radii } = useTheme();
  const [draft, setDraft] = useState("");

  const commit = (raw: string = draft) => {
    const items = raw
      .split(",")
      .map((s) => s.trim().replace(/^#/, ""))
      .filter(Boolean);
    setDraft("");
    const next = [...value];
    for (const item of items) {
      if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) {
        next.push(item);
      }
    }
    if (next.length !== value.length) {
      onChange(next);
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<{ key: string }>) => {
    if (e.nativeEvent.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <View style={styles.container}>
      {value.map((tag) => (
        <View
          key={tag}
          style={[
            styles.chip,
            {
              backgroundColor: colors.surfaceHighlight,
              borderRadius: radii.controls / 2,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: colors.ink }]}>
            {prefix}
            {tag}
          </Text>
          <Pressable
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${tag}`}
            onPress={() => onChange(value.filter((v) => v !== tag))}
            style={({ pressed }) => [
              styles.removeBtn,
              {
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="x" size={13} color={colors.muted} />
          </Pressable>
        </View>
      ))}
      <TextInput
        selectionColor={colors.hanko}
        cursorColor={colors.hanko}
        value={draft}
        onChangeText={(text) => {
          if (text.includes(",")) {
            commit(text);
          } else {
            setDraft(text);
          }
        }}
        onKeyPress={handleKeyPress}
        onSubmitEditing={() => commit(draft)}
        onBlur={() => commit(draft)}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  removeBtn: {
    padding: 2,
  },
  input: {
    fontSize: 13,
    minWidth: 80,
    flexGrow: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
});
