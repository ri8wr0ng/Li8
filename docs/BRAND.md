# li8 brand

li8 is a private notebook and a tracker for reading and watching progress.

**Tagline:** Remember where you left off.

## Personality

li8 should feel like a good paper notebook with a red bookmark ribbon: warm, quiet and quick. The paper is calm, and the only loud color is the red you tap to move forward.

- **Calm surfaces, one loud action.** Hanko red is used only for the main forward action (+1 chapter, New note, Add series) and for the logo.
- **Numbers are the hero in the Library.** Chapter numbers are large, monospaced and tabular, so you can read your place at a glance.
- **Fast over clever.** Every flow has a keyboard path (⌘K, `/`, Ctrl F, `btth 349`).

## Logo

`assets/icon.svg`: a paper-colored bookmark ribbon with two lines of ink, on a rounded Hanko-red square.

- The rounded square (`rx 14/64`) is the app icon. Next to the word "li8" it forms the wordmark.
- The maskable version (`public/icon-maskable.svg`) bleeds to the edges, with the ribbon scaled to 72% so it stays inside Android's safe zone.
- Don't recolor the ribbon, add a drop shadow, or put the mark on a red background.

## Color

| Token                  | Light (Paper) | Dark (Ink)              | Use                             |
| ---------------------- | ------------- | ----------------------- | ------------------------------- |
| `--paper` / background | `#F7F4EE`     | `#131210`               | App background                  |
| card                   | `#FFFDF9`     | `#1B1A17`               | Cards, inputs, popovers         |
| `--ink` / foreground   | `#1C1A17`     | `#EEE9E0`               | Text, primary buttons           |
| muted text             | `#6E675C`     | `#9D968A`               | Secondary text                  |
| border                 | `#E3DDD1`     | `#2C2A26`               | Hairlines                       |
| `--hanko`              | `#E5412D`     | `#FF5A43`               | Forward actions, logo, progress |
| `--marker`             | `#FFE066`     | `rgb(255 214 10 / .34)` | Search highlights               |
| `--marker-active`      | `#FF9F1C`     | `#FFB020`               | Current find-in-note match      |

The marker colors exist only for search highlighting. A highlighted word should look like it was marked with a highlighter pen.

## Type

| Role                                                       | Font           | Notes                                                 |
| ---------------------------------------------------------- | -------------- | ----------------------------------------------------- |
| Display: page titles, note titles, series titles, wordmark | **Geist**      | Semibold, tracking −0.02em                            |
| UI and body text                                           | **Roboto**     | 15–17px body; note text is 17px with 1.75 line height |
| Numbers: chapters, counts, shortcuts                       | **Geist Mono** | Always `tabular-nums`                                 |

All fonts are self-hosted through `@fontsource-variable`, so they work offline and in the installed app.

## Shape and motion

- Radius is 12px (`rounded-xl`) for controls, 16px (`rounded-2xl`) for cards, and fully round for the chapter buttons.
- Press feedback is a scale-down (`active:scale-90`/`95`), with no bounce.
- Shadows are soft and warm (`rgba(28,26,23,…)`) and used sparingly. Cards gain a shadow on hover.

## Voice

Short and plain, in the second person, with no exclamation marks.

- "Saved" · "Couldn't save · Retry" · "Nothing matches “btth”." · "Chapter changes will show up here."
- Empty states teach one shortcut, such as "press ⌘K and type `btth 349`".
