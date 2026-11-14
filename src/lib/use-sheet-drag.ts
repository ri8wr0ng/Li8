import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { project, rubberband, VelocityTracker } from "#/lib/motion";
import { vibrate } from "#/lib/swipe";

const START = 6; // px of movement before a press on the handle becomes a drag (taps on its buttons still work)
const SETTLE = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)"; // iOS sheet curve, no overshoot
const AWAY_MS = 220;

/**
 * Drag a bottom sheet down to dismiss it, the way iOS sheets work: it tracks
 * the finger 1:1, resists when pulled up, and on release closes if the throw
 * would carry it past a third of its height; otherwise it settles back.
 * Grabbing it while it's settling picks it up from where it is on screen.
 *
 * Spread `handleProps` on the sheet's header/grabber, put `sheetRef` on the
 * sheet. While dismissing by drag the sheet gets `data-dragged`, so callers can
 * skip their own exit animation (it has already left).
 */
export function useSheetDrag({ onDismiss, enabled = true }: { onDismiss: () => void; enabled?: boolean }) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{ id: number; startY: number; from: number; y: number; active: boolean; tracker: VelocityTracker } | null>(null);

  const set = (y: number, transition: string) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
  };

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      // Sheets only exist on phones; on desktop the same header belongs to a fixed column.
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      const el = sheetRef.current;
      if (!el) return;
      // Start from the sheet's live position, so grabbing it mid-settle doesn't jump.
      const from = new DOMMatrix(getComputedStyle(el).transform).m42 || 0;
      drag.current = { id: e.pointerId, startY: e.clientY, from, y: from, active: false, tracker: new VelocityTracker() };
    },
    [enabled],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (Math.abs(dy) < START) return;
      d.active = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Pointer already gone (e.g. lifted between events): the drag still works within bounds.
      }
      // If the enter animation is still running, jump it to its end so the inline transform
      // takes over. (Not animation: none, which would also block the sheet's normal exit later.)
      el.getAnimations().forEach((a) => a.finish());
    }
    const raw = d.from + dy;
    d.y = raw >= 0 ? raw : -rubberband(-raw, el.offsetHeight);
    d.tracker.add(raw);
    set(d.y, "none");
  }, []);

  const finish = useCallback(
    (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
      const d = drag.current;
      drag.current = null;
      const el = sheetRef.current;
      if (!d || d.id !== e.pointerId || !d.active || !el) return;
      const velocity = d.tracker.velocity();
      const projected = d.y + project(velocity);
      if (!cancelled && projected > el.offsetHeight / 3) {
        // Leave along the path it was already travelling, then let the caller unmount it.
        el.dataset.dragged = "";
        vibrate(6);
        set(el.offsetHeight + 48, `transform ${AWAY_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`);
        window.setTimeout(onDismiss, AWAY_MS);
      } else {
        set(0, SETTLE);
      }
    },
    [onDismiss],
  );

  return {
    sheetRef,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
      // The handle owns vertical drags; nothing inside it scrolls.
      style: { touchAction: "none", userSelect: "none", WebkitUserSelect: "none" } as const,
      // No native text/image drag starting from the handle (it would cancel the pointer stream).
      onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
    },
  };
}
