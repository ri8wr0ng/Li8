import {
  adventurerNeutral,
  glass,
  lorelei,
  notionistsNeutral,
  shapes,
  thumbs,
} from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useMemo } from "react";
import { cn } from "#/lib/utils";

const draw = { seed: "", size: 128 };

/** Keep in sync with AVATAR_STYLES in convex/users.ts. */
export const AVATAR_STYLES = {
  notionistsNeutral: {
    label: "Sketch",
    uri: (seed: string) => createAvatar(notionistsNeutral, { ...draw, seed }).toDataUri(),
  },
  lorelei: {
    label: "Portrait",
    uri: (seed: string) => createAvatar(lorelei, { ...draw, seed }).toDataUri(),
  },
  adventurerNeutral: {
    label: "Adventurer",
    uri: (seed: string) => createAvatar(adventurerNeutral, { ...draw, seed }).toDataUri(),
  },
  thumbs: {
    label: "Thumbs",
    uri: (seed: string) => createAvatar(thumbs, { ...draw, seed }).toDataUri(),
  },
  shapes: {
    label: "Shapes",
    uri: (seed: string) => createAvatar(shapes, { ...draw, seed }).toDataUri(),
  },
  glass: {
    label: "Glass",
    uri: (seed: string) => createAvatar(glass, { ...draw, seed }).toDataUri(),
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

/** Drawn on the device from a seed (the account id by default); nothing is fetched. */
export function avatarUri(style: string | null | undefined, seed: string) {
  return AVATAR_STYLES[isAvatarStyle(style) ? style : DEFAULT_AVATAR_STYLE].uri(seed);
}

export function UserAvatar({
  user,
  className,
}: {
  user:
    | {
        id: string;
        name: string | null;
        email: string | null;
        avatarStyle?: string | null;
        avatarSeed?: string | null;
      }
    | null
    | undefined;
  className?: string;
}) {
  const style = user?.avatarStyle;
  const seed = user ? (user.avatarSeed ?? user.id) : null;
  const src = useMemo(() => (seed ? avatarUri(style, seed) : null), [style, seed]);
  const initials = (user?.name ?? user?.email ?? "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-display text-sm font-semibold",
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full" draggable={false} /> : initials || "·"}
    </span>
  );
}
