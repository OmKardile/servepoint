import { useState, useEffect, useRef } from 'react';

/**
 * useCountUp — animates a number from 0 (or a previous value) up to `target`
 * over `duration` ms using requestAnimationFrame with an ease-out cubic curve.
 *
 * Use for KPI cards so that revenue / order counts / AOV visibly "tick up" on
 * mount instead of appearing as static text — gives the Reports screen a live
 * dashboard feel without re-rendering the whole tree.
 *
 * @param target   the final number to settle on
 * @param duration ms spent animating (default 900ms)
 * @param decimals how many decimal places to render (default 0; use 2 for ₹)
 * @returns the current animated value as a number
 */
export function useCountUp(target: number, duration = 900, decimals = 0): number {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    // Reset on target change so a new KPI animates from the previous value.
    fromRef.current = value;
    startRef.current = null;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const next = fromRef.current + (target - fromRef.current) * eased;
      // Round to the requested precision to avoid float jitter.
      const factor = Math.pow(10, decimals);
      setValue(Math.round(next * factor) / factor);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, decimals]);

  return value;
}

/**
 * useCountUpFormatted — same as useCountUp but returns a pre-formatted string
 * (e.g. "6,862" or "428.88") so the Reports KPI cards can render directly.
 */
export function useCountUpFormatted(
  target: number,
  duration = 900,
  decimals = 0
): string {
  const value = useCountUp(target, duration, decimals);
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
