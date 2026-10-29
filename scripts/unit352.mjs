/* unit352 — v5.311.0 "the demo account gets its tour" (agreement shape)
 * The owner asked the demo account to greet its reviewer with a guided
 * tour. THE FEATURE: DemoTour — a welcome card naming the demo account and
 * the sample-data honesty, seven spotlight stops down the sidebar rail
 * (one sentence each), and a done card pointing at the restart door. The
 * tour exists ONLY for the demo session email; the auto-open runs once per
 * browser (localStorage); the sidebar's "Demo tour" button relaunches it;
 * Escape skips. House clothes only — teal-ink scrim, gold spotlight ring,
 * the sp-cta ask — zero new colors. unit351's AuthScreen work stands
 * untouched; its version literal relaxed per the 320→…→352 chain. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const tour = read('src/components/shell/DemoTour.tsx');
const sidebar = read('src/components/shell/Sidebar.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit352 · the demo gate is one named email, lowercased', () => {
  assert.ok(
    tour.includes("export const DEMO_OWNER_EMAIL = 'cheeseburg@gmail.com';"),
    'the one demo email',
  );
  assert.ok(
    tour.includes("export const isDemoSession = (email: string | null | undefined): boolean =>"),
    'the gate helper exists',
  );
  assert.ok(
    tour.includes("(email || '').trim().toLowerCase() === DEMO_OWNER_EMAIL"),
    'the compare lowercases and trims',
  );
});

test('unit352 · the tour renders only for the demo session', () => {
  assert.ok(
    tour.includes('if (!open || !isDemoSession(session?.email)) return null;'),
    'the render gate reads the session email',
  );
  // the sidebar wires the SAME gate — non-demo accounts never mount the walk
  assert.ok(sidebar.includes('const isDemo = isDemoSession(session?.email);'), 'the rail knows the demo');
  assert.ok(sidebar.includes('{isDemo && ('), 'the relaunch button is demo-gated');
});

test('unit352 · one auto-open per browser, the sidebar relaunches', () => {
  assert.ok(tour.includes("export const DEMO_TOUR_DONE_KEY = 'servepoint.demoTour.done.v1';"), 'the key');
  assert.ok(tour.includes("window.localStorage.getItem(DEMO_TOUR_DONE_KEY) === 'done'"), 'the read');
  assert.ok(tour.includes('window.localStorage.setItem(DEMO_TOUR_DONE_KEY'), 'the write');
  assert.ok(sidebar.includes('if (!isDemo || wasTourDone()) return;'), 'the auto-open respects the memory');
  assert.ok(sidebar.includes('window.setTimeout(() => setTourOpen(true), 900)'), 'the auto-open waits for the dashboard to settle');
  assert.ok(sidebar.includes('aria-label="Start the demo tour"'), 'the relaunch door is named');
});

test('unit352 · seven stops in the reviewer order, one sentence each', () => {
  const labels = [
    'Dashboard',
    'Food & Drinks',
    'Kitchen',
    'Bills',
    'Reports',
    'Inventory',
    'Settings',
  ];
  for (const label of labels) {
    assert.ok(tour.includes(`label: '${label}',`), `the ${label} stop`);
  }
  // the order is the file's own order (Dashboard first, Settings last)
  const first = tour.indexOf("label: 'Dashboard',");
  const last = tour.indexOf("label: 'Settings',");
  assert.ok(first > -1 && last > first, 'the walk runs forward');
  // each stop anchors to the rail's own button (the title attribute)
  assert.ok(
    tour.includes('aside[aria-label="Primary navigation"] button[title="${label}"]'),
    'the anchor reads the rail',
  );
});

test('unit352 · the welcome card names the demo; the done card names the door', () => {
  assert.ok(tour.includes('Welcome to the demo'), 'the welcome title');
  assert.ok(
    tour.includes("You're signed in to CheeseBurg, the demo cafe"),
    'the welcome names the account',
  );
  assert.ok(tour.includes('the data is sample data'), 'the honesty line');
  assert.ok(tour.includes("You're all set"), 'the done title');
  assert.ok(tour.includes('Restart the tour any time from the sidebar.'), 'the restart door');
  assert.ok(tour.includes("'Start the tour'"), 'the welcome ask');
  assert.ok(tour.includes('>Skip tour<') || /Skip tour\s*<\/button>/.test(tour), 'the honest exit');
});

test('unit352 · the spotlight anatomy — teal scrim, gold ring, modal voice', () => {
  assert.ok(
    tour.includes("boxShadow: '0 0 0 9999px rgba(15, 61, 62, 0.55)'"),
    'the teal-ink scrim (the rail’s own #0F3D3E)',
  );
  assert.ok(tour.includes("border-2 border-[#B88E2F]"), 'the gold ring');
  assert.ok(tour.includes('pointer-events-none fixed z-[71]'), 'the hole never eats taps');
  assert.ok(tour.includes('<div className="fixed inset-0 z-[69]" aria-hidden />'), 'the click-swallower');
  assert.ok(tour.includes('role="dialog"'), 'a dialog speaks its role');
  assert.ok(tour.includes('aria-modal="true"'), 'modal voice');
  assert.ok(tour.includes('aria-label="Demo guided tour"'), 'the dialog is named');
  assert.ok(tour.includes("if (e.key === 'Escape') handleClose();"), 'Escape closes');
});

test('unit352 · zero new colors — the tour wears only house hexes', () => {
  const hexes = [...tour.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase());
  const allowed = new Set([
    '#1A1A1A', '#6B6B6B', '#969696', '#B88E2F', '#0F3D3E',
    '#C9CFC9', '#E3E7E0', '#F6F5F2',
  ]);
  const strangers = [...new Set(hexes)].filter((h) => !allowed.has(h));
  assert.deepEqual(strangers, [], 'no stranger hexes on the tour');
  // the sidebar's own palette untouched (the rail's hexes are the rail's)
  const sidebarHexes = [...sidebar.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0].toUpperCase());
  const sidebarAllowed = new Set([
    '#0F3D3E', '#0B2E2F', '#B88E2F', '#F6F1E9', '#D9E2DD', '#FFFFFF',
  ]);
  const sidebarStrangers = [...new Set(sidebarHexes)].filter((h) => !sidebarAllowed.has(h));
  assert.deepEqual(sidebarStrangers, [], 'no stranger hexes on the rail');
});

test('unit352 · the version law — the two words agree at 5.311.0', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.311.0', 'the round word');
  assert.ok(tour.includes('v5.311.0'), 'the tour names its round');
});
