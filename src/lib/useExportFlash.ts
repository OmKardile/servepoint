import { useTransientFlag } from './useTransientFlag';

/* v5.274.0 — the export's own ack. downloadCsv() is fire-and-forget by
 * design (the browser owns the download tray), and the CSV verbs were the
 * only leaves in the house whose tap produced NO visible response of
 * their own — on a counter tablet, where the tray hides until swiped, a
 * cashier reads the silence as a missed tap and taps again: two identical files
 * for one export. This hook gives the verb its second voice: run()
 * hands the export through, then the button speaks its confirmation for a
 * breath (the caller wears the house's green — the paid chip's own #2E7D32
 * register — with the Check ear and a "Saved" word), then returns. A
 * re-tap inside the window just re-arms — a second honest export still
 * exports, it only restarts the word.
 * v5.276.0 — the breath's clock moved to the ONE home (useTransientFlag):
 * the timer, the re-arm and the unmount cleanup live there now; this hook
 * keeps its own shape — FLASH_MS, the run-then-speak order — and the
 * green register stays the CsvExportButton's word. */
const FLASH_MS = 2200;

export function useExportFlash(): [boolean, (run: () => void) => void] {
  const [saved, setSaved] = useTransientFlag(FLASH_MS);

  const speak = (run: () => void): void => {
    run();
    setSaved();
  };

  return [saved, speak];
}
