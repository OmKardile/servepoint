import { useEffect, useRef, useState } from 'react';

/* v5.274.0 — the export's own ack. downloadCsv() is fire-and-forget by
 * design (the browser owns the download tray), and the CSV verbs were the
 * only leaves in the house whose tap produced NO visible response of their
 * own — on a counter tablet, where the tray hides until swiped, a cashier
 * reads the silence as a missed tap and taps again: two identical files
 * for one export. This hook gives the verb its second voice: run() hands
 * the export through, then the button speaks its confirmation for a breath
 * (the caller wears the house's green — the paid chip's own #2E7D32
 * register — with the Check ear and a "Saved" word), then returns. One
 * timer, cleaned up on unmount; a re-tap inside the window just re-arms —
 * a second honest export still exports, it only restarts the word. */
const FLASH_MS = 2200;

export function useExportFlash(): [boolean, (run: () => void) => void] {
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const speak = (run: () => void): void => {
    run();
    setSaved(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaved(false), FLASH_MS);
  };

  return [saved, speak];
}
