/* The path grammar (v5.93.0 → v5.235.0) — which section does a pathname name?
 *
 * v5.93.0 — the sidebar's words are the URLs. Two rail names differ from
 * their section ids (the rail says "Close-out", the code says 'eod'; the rail
 * says "Guests", the code says 'customers') — and until then only the code's
 * word was deep-linkable: /close-out and /guests fell through to Dashboard
 * while /eod and /customers worked, words no human ever bookmarks. Staff
 * bookmark what the rail SAYS, so every spoken name resolves — alongside the
 * plain ids, which keep working untouched.
 *
 * v5.235.0 — the slug rules AND the derivation live here as ONE home with
 * THREE readers and ONE writer, all asking the same closure: the 404 door
 * and the boot deep-link (App.tsx), and the URL write-back (goSection in
 * store/session — the navigation act claims the address, so a mid-shift
 * refresh restores the room). The store cannot import App.tsx (cycle), and
 * SECTION_LABELS lives beside the rail's own words — so the id list is
 * spelled out here once; unit274 pins it against the Section union in
 * store/session, so a new section that skips this array fails the gate.
 * The derivation is pure (slugs passed IN), no component imports.
 */
import type { Section } from '../store/session';

/** Every section the shell can show, spelled out — the suite pins this
 *  list against the Section union (drift = a red gate, never a silent
 *  deep-link miss). */
export const SECTION_IDS: readonly Section[] = Object.freeze([
  'dashboard',
  'food',
  'kitchen',
  'bills',
  'eod',
  'reports',
  'inventory',
  'customers',
  'floor',
  'menu',
  'settings',
  'notifications',
  'messages',
  'support',
]);

/** Plain ids PLUS the rail's spoken names (v5.93) — every slug a human
 *  might bookmark or an address might carry. */
export const SECTION_SLUGS: Readonly<Record<string, Section>> = Object.freeze(
  Object.fromEntries([
    ...SECTION_IDS.map((id) => [id, id] as [string, Section]),
    ['close-out', 'eod'],
    ['guests', 'customers'],
  ] as [string, Section][])
);

/** The ONE path grammar: `/bills` → 'bills'; the two-segment pinned-wall
 *  form (`/:slug/:screen`) reads the SECOND segment (`/cafe/bills` → 'bills');
 *  a spoken alias resolves when the slugs carry it (`/close-out` → 'eod');
 *  the bare root names nothing (undefined — Dashboard is the boot default,
 *  not a path claim); an unknown word names nothing. */
export const sectionFromPath = (
  slugs: Readonly<Record<string, Section>>,
  path: string,
): Section | undefined => {
  const parts = path.split('/').filter(Boolean);
  const seg = parts.length >= 2 ? parts[1] : parts[0];
  return seg ? slugs[seg] : undefined;
};
