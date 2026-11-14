import "react";

declare module "react" {
  /** Allow CSS custom properties (`--foo`) in `style` objects. */
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
