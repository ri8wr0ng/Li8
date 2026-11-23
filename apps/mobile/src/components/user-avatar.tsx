import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import * as notionistsNeutral from "@dicebear/notionists-neutral";
import * as lorelei from "@dicebear/lorelei";
import * as adventurerNeutral from "@dicebear/adventurer-neutral";
import * as thumbs from "@dicebear/thumbs";
import * as shapes from "@dicebear/shapes";
import * as glass from "@dicebear/glass";
import { useTheme } from "../theme";

/** Keep in sync with AVATAR_STYLES in apps/web/src/components/user-avatar.tsx and convex/users.ts. */
const draw = { size: 128 };
export const AVATAR_STYLES = {
  notionistsNeutral: {
    label: "Sketch",
    svg: (seed: string) => createAvatar(notionistsNeutral, { ...draw, seed }).toString(),
  },
  lorelei: {
    label: "Portrait",
    svg: (seed: string) => createAvatar(lorelei, { ...draw, seed }).toString(),
  },
  adventurerNeutral: {
    label: "Adventurer",
    svg: (seed: string) => createAvatar(adventurerNeutral, { ...draw, seed }).toString(),
  },
  thumbs: {
    label: "Thumbs",
    svg: (seed: string) => createAvatar(thumbs, { ...draw, seed }).toString(),
  },
  shapes: {
    label: "Shapes",
    svg: (seed: string) => createAvatar(shapes, { ...draw, seed }).toString(),
  },
  glass: {
    label: "Glass",
    svg: (seed: string) => createAvatar(glass, { ...draw, seed }).toString(),
  },
} as const;

export type AvatarStyle = keyof typeof AVATAR_STYLES;
export const AVATAR_STYLE_KEYS: AvatarStyle[] = [
  "notionistsNeutral",
  "lorelei",
  "adventurerNeutral",
  "thumbs",
  "shapes",
  "glass",
];
export const DEFAULT_AVATAR_STYLE: AvatarStyle = "notionistsNeutral";

export const isAvatarStyle = (s: unknown): s is AvatarStyle =>
  typeof s === "string" && s in AVATAR_STYLES;

/** Drawn on the device from a seed (the account id by default), same as the web; nothing is fetched. */
export function avatarSvg(style: string | null | undefined, seed: string) {
  return AVATAR_STYLES[isAvatarStyle(style) ? style : DEFAULT_AVATAR_STYLE].svg(seed);
}

type AvatarUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatarStyle?: string | null;
  avatarSeed?: string | null;
};

export function UserAvatar({
  user,
  size = 32,
  style,
}: {
  user: AvatarUser | null | undefined;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const avatarStyle = user?.avatarStyle;
  const seed = user ? (user.avatarSeed ?? user.id) : null;
  const xml = useMemo(() => (seed ? avatarSvg(avatarStyle, seed) : null), [avatarStyle, seed]);
  const initial = (user?.name?.[0] || user?.email?.[0] || "").toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceHighlight,
        },
        style,
      ]}
    >
      {xml ? (
        <SvgXml xml={xml} width={size} height={size} />
      ) : (
        <Text style={{ fontSize: size * 0.45, fontWeight: "700", color: colors.hanko }}>
          {initial || "·"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
