/* unit351 — v5.310.0 "the gate shows its demo key" (agreement shape)
 * The owner directed the sign-in screen to display the demo tenant's
 * owner sign-in. THE FEATURE: a minimal dashed strip under the form —
 * the words "Demo credentials", both values in mono, one tap fills the
 * fields (and clears any error). The strip lives OUTSIDE the form so it
 * can never submit it, wears only the house's own colors, and the
 * neighbours (welcome words, gold CTA, eye toggle, provisioned note)
 * stand byte-still. 5.309.0 is SKIPPED — the lost hunt's number — so
 * the version law pins 5.310.0. */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(`/home/z/my-project/${p}`, 'utf8');

const auth = read('src/components/auth/AuthScreen.tsx');
const version = read('src/version.ts');
const sw = read('public/sw.js');

test('unit351 · the gate speaks both demo values, byte-exact', () => {
  assert.ok(auth.includes("email: 'CheeseBurg@gmail.com',"), 'the demo email');
  assert.ok(auth.includes("password: 'iV4Bc@5#dHWdp!Mu',"), 'the demo password');
  assert.ok(auth.includes('const DEMO_CREDENTIALS = {'), 'the one named home');
  assert.equal(
    auth.split('DEMO_CREDENTIALS = {').length - 1,
    1,
    'one definition',
  );
});

test('unit351 · one tap fills both fields and clears the error', () => {
  const i = auth.indexOf(
    'aria-label="Fill the form with the demo account credentials"',
  );
  assert.ok(i > -1, 'the fill button exists');
  // the WHOLE button element, order-independent (the hands sit above the label)
  const demo = auth.slice(auth.lastIndexOf('<button', i), auth.indexOf('</button>', i));
  assert.ok(demo.includes('setEmail(DEMO_CREDENTIALS.email);'), 'the email hand');
  assert.ok(
    demo.includes('setPassword(DEMO_CREDENTIALS.password);'),
    'the password hand',
  );
  assert.ok(demo.includes('setError(null);'), 'the error clears');
});

test('unit351 · the strip is a button that can never submit the form', () => {
  const i = auth.indexOf(
    'aria-label="Fill the form with the demo account credentials"',
  );
  const demo = auth.slice(auth.lastIndexOf('<button', i), auth.indexOf('</button>', i));
  assert.ok(demo.includes('type="button"'), 'a button, not a submit');
  // and it lives OUTSIDE the form element
  const formClose = auth.indexOf('</form>');
  assert.ok(i > formClose, 'outside the form');
});

test('unit351 · the strip wears the house words and mono values', () => {
  assert.ok(auth.includes('Demo credentials'), 'the label');
  assert.ok(auth.includes('Tap to fill'), 'the invitation');
  const i = auth.indexOf(
    'aria-label="Fill the form with the demo account credentials"',
  );
  const demo = auth.slice(i, auth.indexOf('</button>', i));
  assert.equal(demo.split('font-mono text-xs').length - 1, 2, 'both values in mono');
  assert.equal(demo.split('truncate').length - 1, 2, 'both values truncate on narrow screens');
});

test('unit351 · zero new colors — the strip wears only house hexes', () => {
  const hexes = [...auth.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) =>
    m[0].toUpperCase(),
  );
  const allowed = new Set([
    '#1A1A1A', '#6B6B6B', '#969696', '#B88E2F', '#967221', '#0F3D3E',
    '#C9CFC9', '#AEB5AE', '#E3E7E0', '#F3F1EC', '#F0D2CE', '#FDF3F2',
    '#B42318', '#F3E8CF',
  ]);
  const strangers = [...new Set(hexes)].filter((h) => !allowed.has(h));
  assert.deepEqual(strangers, [], 'no stranger hexes on the gate');
});

test('unit351 · the neighbours stand byte-still', () => {
  assert.ok(auth.includes('Welcome Back!'), 'the welcome word');
  assert.ok(auth.includes('Please sign in to continue'), 'the invitation line');
  assert.ok(auth.includes('<span>Sign in</span>'), 'the gold CTA word');
  assert.ok(
    auth.includes('Accounts are provisioned, not self-registered'),
    'the note title',
  );
  assert.ok(
    auth.includes("aria-label={showPassword ? 'Hide password' : 'Show password'}"),
    'the eye toggle',
  );
  assert.ok(auth.includes('id="signin-email"'), 'the email field');
  assert.ok(auth.includes('id="signin-password"'), 'the password field');
});

test('unit351 · the demo values are consumed, never re-typed in JSX', () => {
  // the JSX reads the constant — the literal creds appear exactly once each
  assert.equal(
    auth.split('CheeseBurg@gmail.com').length - 1,
    1,
    'the email literal lives only in the constant',
  );
  assert.equal(
    auth.split('iV4Bc@5#dHWdp!Mu').length - 1,
    1,
    'the password literal lives only in the constant',
  );
});

test('unit351 · the version law — the two words agree at 5.310.0', () => {
  const v = version.match(/export const APP_VERSION = '([^']+)';/);
  const s = sw.match(/const VERSION = "servepoint-v([^-]+)-r(\d+)"/);
  assert.ok(v, 'version.ts must speak APP_VERSION');
  assert.ok(s, 'sw.js must bake the cache word');
  assert.equal(v[1], s[1], 'the two words must agree');
  assert.equal(v[1], '5.310.0', 'the round word');
  assert.ok(auth.includes('v5.310.0'), 'the screen names its round');
});
