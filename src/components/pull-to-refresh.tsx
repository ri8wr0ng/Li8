import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Kept in step with isRefreshing by the touch handlers, which set both.
  const isRefreshingRef = useRef(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const touchIdRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const passedThresholdRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!isCoarsePointer || !container) return undefined;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || window.scrollY > 0) return;
      const touch = e.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      touchIdRef.current = touch.identifier;
      isPullingRef.current = false;
      passedThresholdRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchIdRef.current === null || isRefreshingRef.current) return;
      const touch = Array.from(e.touches).find((t) => t.identifier === touchIdRef.current);
      if (!touch) return;

      const dy = touch.clientY - startYRef.current;
      const dx = touch.clientX - startXRef.current;

      if (!isPullingRef.current) {
        if (dy > 6 && dy > Math.abs(dx) * 1.2 && window.scrollY <= 0) {
          isPullingRef.current = true;
          setIsDragging(true);
        } else if (dy < 0 || Math.abs(dx) > dy) {
          touchIdRef.current = null;
          return;
        }
      }

      if (isPullingRef.current && dy > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        // Rubber-band resistance: distance * 0.5, capped ~96px
        const distance = Math.min(96, Math.max(0, dy * 0.5));
        setPullDistance(distance);

        if (distance >= 64 && !passedThresholdRef.current) {
          passedThresholdRef.current = true;
          try {
            navigator.vibrate?.(8);
          } catch {}
        } else if (distance < 64 && passedThresholdRef.current) {
          passedThresholdRef.current = false;
        }
      }
    };

    const onTouchEnd = async (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
      if (!touch && e.touches.length > 0) return;

      touchIdRef.current = null;
      const wasPulling = isPullingRef.current;
      isPullingRef.current = false;
      setIsDragging(false);

      if (wasPulling && passedThresholdRef.current && !isRefreshingRef.current) {
        setIsRefreshing(true);
        isRefreshingRef.current = true;
        setPullDistance(56);

        const startTime = Date.now();
        try {
          await Promise.resolve(onRefreshRef.current());
        } catch (err) {
          console.error("Pull-to-refresh failed", err);
        } finally {
          const elapsed = Date.now() - startTime;
          if (elapsed < 500) {
            await new Promise((r) => setTimeout(r, 500 - elapsed));
          }
          setIsRefreshing(false);
          isRefreshingRef.current = false;
          setPullDistance(0);
          passedThresholdRef.current = false;
        }
      } else {
        setPullDistance(0);
        passedThresholdRef.current = false;
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isCoarsePointer]);

  if (!isCoarsePointer) {
    return <>{children}</>;
  }

  const threshold = 64;
  const progress = Math.min(1, pullDistance / threshold);
  const showIndicator = pullDistance > 0 || isRefreshing;
  const rotation = isRefreshing ? 0 : progress * 360;

  const transitionStyle = isDragging
    ? "none"
    : reducedMotion
      ? "none"
      : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Floating indicator */}
      {showIndicator && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-center"
          style={{
            transform: `translateY(${Math.max(8, pullDistance - 44)}px)`,
            opacity: isRefreshing ? 1 : Math.min(1, (pullDistance - 10) / 30),
            transition: isDragging
              ? "none"
              : reducedMotion
                ? "none"
                : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1), opacity 150ms ease",
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-md text-foreground">
            <svg
              className={`h-5 w-5 ${isRefreshing && !reducedMotion ? "animate-spin text-primary" : "text-muted-foreground"}`}
              viewBox="0 0 24 24"
              fill="none"
              style={
                !isRefreshing && !reducedMotion
                  ? { transform: `rotate(${rotation}deg)` }
                  : undefined
              }
            >
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="opacity-20"
              />
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={53.4}
                strokeDashoffset={isRefreshing ? 18 : 53.4 * (1 - progress * 0.75)}
                className="text-primary transition-all duration-75"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Content wrapper translated with transform only (no layout shifts) */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: transitionStyle,
          willChange: isDragging ? "transform" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
