import { useEffect, useRef, useState } from 'react';
import { copyText } from './clipboard';

/* v5.277.0 — the ack's ONE home. A census over the whole house's copy
 * verbs found the ack (the state that says "Copied" and takes itself
 * back) rendered in SIX hand-rolled grammars: twelve tri-state sites
 * (menu, the shelf's two, reports' six, bills' two, the closeout) each
 * stacking a fresh 1800ms timer on every tap with no unmount cleanup and
 * a try/catch ceremony around a boolean that stopped throwing in
 * v5.276.0; the guests book's keyed {id, ok} object; the floor's three
 * keyed pairs (two on the cards, two in the dialog) whose token verbs
 * failed SILENTLY; support's two local booleans; the wizard's and the
 * platform page's own timer refs; and settings riding the flag lib.
 * Some of those were honest about success and silent about refusal; the
 * tri-state family told the truth but stacked its timers; none of them
 * shared one line of it. THE ONE HOME: two hooks and one word —
 * useCopyAck for the single verb, useKeyedCopyAck for the per-row and
 * per-kind verbs, ackWord for the "Copied" / "Copy blocked" / idle word
 * itself. Every ack rides copyText's one door (v5.276.0), so the honest
 * boolean decides the kind — a refused copy is an ANSWER and every verb
 * in the house now says it out loud. The breath law is the flag lib's
 * own (v5.276.0): a re-tap RE-ARMS the word — it never stacks a second
 * timer — and the timer is cleaned up on unmount so no ack outlives its
 * surface. */

/** how the verb's ack currently reads: quiet, succeeded, or refused. */
export type CopyAckKind = 'ok' | 'fail';
export type CopyAckState = 'idle' | CopyAckKind;

/** which verb spoke, and how — the keyed hooks' shape. */
export interface KeyedCopyAck {
  id: string;
  kind: CopyAckKind;
}

/* the shared breath: one state, one timer, re-armed on every speak,
 * cleaned up on unmount. Both hooks ride this; the shape never leaks. */
function useAckBreath(ms: number): [{ id: string; kind: CopyAckKind } | null, (id: string, ok: boolean) => void] {
  const [ack, setAck] = useState<{ id: string; kind: CopyAckKind } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const speak = (id: string, ok: boolean) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setAck({ id, kind: ok ? 'ok' : 'fail' });
    timer.current = window.setTimeout(() => setAck(null), ms);
  };

  return [ack, speak];
}

/** [ack, run] for ONE copy verb — run(text) sends the text through the
 *  one door and speaks the result for `ms`, then goes quiet again. */
export function useCopyAck(ms = 1800): [CopyAckState, (text: string) => void] {
  const [ack, speak] = useAckBreath(ms);
  const run = (text: string) => {
    void copyText(text).then((ok) => speak('', ok));
  };
  return [ack ? ack.kind : 'idle', run];
}

/** [ack, run] for a FAMILY of copy verbs (per-row, per-kind) — run(id,
 *  text) speaks only the verb whose id matches; the others keep their
 *  own silence (sharing a word would lie about what was copied). */
export function useKeyedCopyAck(ms = 2000): [KeyedCopyAck | null, (id: string, text: string) => void] {
  const [ack, speak] = useAckBreath(ms);
  const run = (id: string, text: string) => {
    void copyText(text).then((ok) => speak(id, ok));
  };
  return [ack, run];
}

/** the word's one home — "Copied" when the copy happened, "Copy blocked"
 *  when it was refused, the surface's own idle word when nothing was
 *  said yet. The literals live HERE and nowhere else. */
export function ackWord(spoke: CopyAckState | CopyAckKind | null, idle: string): string {
  if (spoke === 'ok') return 'Copied';
  if (spoke === 'fail') return 'Copy blocked';
  return idle;
}
