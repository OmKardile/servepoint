import { useEffect, useRef, useState } from 'react';

/* v5.276.0 — the breath's ONE home. The timed confirmation flag — the
 * word that says a verb acted and then takes itself back — was spelled
 * out THREE times in the house: useExportFlash (the export's own ack),
 * and two local useTransientFlag copies (menu, settings), each with its
 * own timer, its own cleanup, its own re-arm. THE ONE BREATH: fire()
 * speaks, the word stands for `ms` (a re-fire re-arms — a second honest
 * tap restarts the word, it never stacks a second timer), and the timer
 * is cleaned up on unmount so no flag outlives its surface. */

/** [speaking, fire] — fire() turns the flag on for `ms`, then off. */
export function useTransientFlag(ms = 2400): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const fire = () => {
    setOn(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), ms);
  };

  return [on, fire];
}
