/**
 * Small physics helpers for gestures, after Apple's "Designing Fluid
 * Interfaces" (WWDC 2018).
 */

/**
 * How far a release at `velocity` (px/s) would carry if it decelerated like a
 * scroll view. Apple's projection; 0.998 is normal scroll feel, 0.99 snappier.
 */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistance past a boundary: the further past it, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Release velocity from recent pointer samples: uses the last ~100ms so a pause
 * before letting go reads as "stopped", not as the speed from earlier.
 */
export class VelocityTracker {
  private samples: { v: number; t: number }[] = [];

  add(value: number, time = performance.now()) {
    this.samples.push({ v: value, t: time });
    if (this.samples.length > 8) this.samples.shift();
  }

  /** px per second at release. */
  velocity(now = performance.now()) {
    const recent = this.samples.filter((s) => now - s.t <= 100);
    if (recent.length < 2) return 0;
    const first = recent[0]!;
    const last = recent[recent.length - 1]!;
    const dt = last.t - first.t;
    return dt > 0 ? ((last.v - first.v) / dt) * 1000 : 0;
  }
}
