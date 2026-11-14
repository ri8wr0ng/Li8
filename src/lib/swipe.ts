import { useCallback, useRef } from "react";
import { project, VelocityTracker } from "#/lib/motion";

const THRESHOLD = 72; // px of travel that arms the action
const SLOP = 8; // px before we decide between "swipe" and "scroll"
const MIN_FLICK = 24; // px a flick must actually travel before momentum can commit it
const SETTLE = "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)";

export function vibrate(pattern: number | number[]) {
  // Android Chrome only; iOS Safari has no Vibration API, so this is a no-op there.
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}

/**
 * Swipe right on a touch screen to run `onCommit`.
 *
 * The surface gets `touch-action: pan-y`, so the browser keeps vertical
 * scrolling and hands us horizontal drags. A drag only starts once it's
 * clearly sideways; anything mostly vertical is left to the scroller (the
 * browser sends `pointercancel` and we spring back). Mouse input is ignored:
 * desktop has the +1 button.
 *
 * Writes styles directly instead of re-rendering on every move.
 */
export function useSwipeRight({ onCommit, enabled }: { onCommit: () => void; enabled: boolean }) {
  const surface = useRef<HTMLElement | null>(null);
  const reveal = useRef<HTMLElement | null>(null);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    state: "pending" | "drag";
    armed: boolean;
    dx: number;
    tracker: VelocityTracker;
  } | null>(null);
  const suppressClick = useRef(false);

  const paint = useCallback((x: number, animate: boolean) => {
    const el = surface.current;
    if (el) {
      el.style.transition = animate ? SETTLE : "none";
      el.style.transform = x ? `translate3d(${x}px,0,0)` : "";
    }
    const r = reveal.current;
    if (r) {
      const progress = Math.min(1, x / THRESHOLD);
      r.style.opacity = String(progress);
      r.dataset.armed = String(x >= THRESHOLD);
    }
  }, []);

  const end = useCallback(
    (commit: boolean) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.state !== "drag") return;
      suppressClick.current = true;
      paint(0, true);
      // A quick flick counts even if it ended short of the threshold: project where
      // the release would carry, the way a scroll view decelerates.
      // 0.995 decelerates faster than a scroll view, and 24px of real travel is required,
      // so slow drags and taps never add a chapter by accident.
      const projected = g.dx + project(Math.max(0, g.tracker.velocity()), 0.995);
      if (commit && (g.armed || (g.dx >= MIN_FLICK && projected >= THRESHOLD))) {
        vibrate(12);
        onCommit();
      }
    },
    [onCommit, paint],
  );

  const handlers = {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      suppressClick.current = false;
      if (!enabled || e.pointerType === "mouse" || !e.isPrimary) return;
      gesture.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        state: "pending",
        armed: false,
        dx: 0,
        tracker: new VelocityTracker(),
      };
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const g = gesture.current;
      if (!g || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (g.state === "pending") {
        if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) {
          gesture.current = null; // a scroll
          return;
        }
        if (dx > SLOP && dx > Math.abs(dy) * 1.2) {
          g.state = "drag";
          e.currentTarget.setPointerCapture(e.pointerId);
        } else return;
      }
      g.dx = dx;
      g.tracker.add(dx);
      // Follow the finger up to the threshold, then resist (rubber band). Leftward barely moves.
      const x = dx <= 0 ? dx * 0.1 : dx <= THRESHOLD ? dx : THRESHOLD + (dx - THRESHOLD) * 0.3;
      const armed = x >= THRESHOLD;
      if (armed && !g.armed) vibrate(6); // a tick when it arms, like a native detent
      g.armed = armed;
      paint(x, false);
    },
    onPointerUp() {
      end(true);
    },
    onPointerCancel() {
      end(false);
    },
    /** Swallow the click that follows a swipe, so it doesn't open the series. */
    onClickCapture(e: React.MouseEvent) {
      if (suppressClick.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick.current = false;
      }
    },
  };

  const attachSurface = useCallback((el: HTMLElement | null) => {
    surface.current = el;
  }, []);
  const attachReveal = useCallback((el: HTMLElement | null) => {
    reveal.current = el;
  }, []);

  return { attachSurface, attachReveal, handlers };
}
