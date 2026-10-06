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

/* ─────────────────────── the platform's own words ───────────────────────
 * v5.286.0 — the Platform console's four rooms join the grammar. The walk
 * found the console speaking NO address at all: the rail's four nav pills
 * were pure state — /businesses fell to the 404 door, a bookmark was
 * impossible, a mid-session refresh threw the operator back to Dashboard.
 * The fix rides the house's ONE law (v5.93: the rail's spoken names are
 * the URLs; v5.235: the reader/writer share one grammar home): the rail
 * says "Audit log", so /audit-log resolves — the plain ids keep working
 * too. The staff SECTION_SLUGS stay untouched ('businesses' is not a staff
 * Section and unit274's pin stands); the platform's words live BESIDE
 * them because the console renders only for superadmin, and its rooms
 * claim the FIRST path segment (the platform has no pinned-wall form).
 * The writer keeps v5.235.0's doctrine byte-for-byte: replaceState, no
 * history pile, the Back key keeps its device-level meaning — and the
 * bare root keeps its throne (Dashboard is the boot default, not a path
 * claim: '/dashboard' is never written). */

/** The Platform console's rooms — the same union PlatformScreen speaks;
 *  the type lives HERE so the slugs and the tab words can never drift. */
export type PlatformTab = 'dashboard' | 'businesses' | 'subscriptions' | 'audit';

/** Every platform word an address might carry: the rail's plain ids plus
 *  the one spoken name that differs ('Audit log' → audit-log, v5.93's
 *  law). Dashboard is deliberately absent — the bare root names it. */
export const PLATFORM_SLUGS: Readonly<Record<string, PlatformTab>> = Object.freeze(
  Object.fromEntries([
    ['businesses', 'businesses'],
    ['subscriptions', 'subscriptions'],
    ['audit-log', 'audit'],
    ['audit', 'audit'],
  ] as [string, PlatformTab][])
);

/** The platform reader: `/businesses` → 'businesses'; `/audit-log` →
 *  'audit'; the bare root names nothing (Dashboard is the boot default);
 *  an unknown word names nothing; only the FIRST segment is read — the
 *  console has no pinned-wall form. */
export const platformTabFromPath = (path: string): PlatformTab | undefined => {
  const seg = path.split('/').filter(Boolean)[0];
  return seg ? PLATFORM_SLUGS[seg] : undefined;
};

/** The platform writer's target: the tab's own word as a path — dashboard
 *  keeps the bare root ('/'), every other room speaks its rail slug. */
export const platformPathForTab = (tab: PlatformTab): string =>
  tab === 'dashboard' ? '/' : `/${
    Object.entries(PLATFORM_SLUGS).find(([, v]) => v === tab)?.[0] ?? tab
  }`;
