import { useEffect, useRef } from 'react';

/* v5.110.0 — dialogs that hold the door. The sweep found 19 role="dialog"
 * surfaces: nine handled Escape by hand (each its own window listener), NONE
 * trapped Tab (a keyboard user could walk straight out the back of a modal
 * into the rail and the room behind it — aria-modal="true" promises the room
 * is gone, and nothing was enforcing it), and NONE returned focus to where
 * the dialog was opened from. This hook is the one discipline for all of
 * them, capture-phase so it wins every race:
 *   Escape  → onClose (call sites guard it themselves — `!busy` stays honest)
 *   Tab     → cycled inside the container; focus cannot leave through the back
 *   on open → the first focusable is focused (or initialFocusRef — drawer
 *             panels pass their own so the invisible backdrop button never
 *             silently holds focus), fallback: the container
 *   on close→ focus returns to the element that opened the dialog
 * The latest-ref pattern keeps the effect bound once per open — call sites
 * pass fresh inline arrows without re-binding anything. */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  active: boolean,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const prevFocus = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0,
      );

    const initial = initialFocusRef?.current;
    if (initial && container.contains(initial)) {
      initial.focus();
    } else {
      const first = focusables()[0];
      if (first) first.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      const cur = document.activeElement;
      const inside = cur instanceof Node && container.contains(cur);
      if (e.shiftKey) {
        if (!inside || cur === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (!inside || cur === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return ref;
}
