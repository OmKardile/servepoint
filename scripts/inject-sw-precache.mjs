#!/usr/bin/env node
/**
 * Inject the hashed build-asset manifest into dist/sw.js after `vite build`.
 *
 * Why: the first page load of a session is NOT controlled by the service
 * worker, so /assets/*.js never pass through the fetch handler and would
 * never be cached at runtime. Precaching them at install is the only way a
 * cold offline reload can boot the SPA. This script globs dist/assets and
 * rewrites the `const BUILD_ASSETS = []` placeholder in the emitted sw.js.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const SW = join(DIST, 'sw.js');
const PLACEHOLDER = 'const BUILD_ASSETS = [];';

if (!existsSync(SW)) {
  console.error('[inject-sw-precache] dist/sw.js not found — run `vite build` first.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const assetsDir = join(DIST, 'assets');
const files = existsSync(assetsDir)
  ? walk(assetsDir).map((f) => `/assets/${f.slice(assetsDir.length + 1).split(/[\\/]/).join('/')}`)
  : [];

let sw = readFileSync(SW, 'utf8');
if (!sw.includes(PLACEHOLDER)) {
  console.error('[inject-sw-precache] BUILD_ASSETS placeholder missing — sw.js changed?');
  process.exit(1);
}

sw = sw.replace(
  PLACEHOLDER,
  `const BUILD_ASSETS = [\n${files.map((f) => `  '${f}',`).join('\n')}\n];`
);
writeFileSync(SW, sw);
console.log(`[inject-sw-precache] injected ${files.length} build asset(s) into dist/sw.js`);
