/**
 * unit286 — v5.247.0 "the porch's census counts itself".
 *
 * The round's laws, pinned:
 *   1. THE CENSUS GUARD — the showcase's numbers are no longer hand-kept:
 *      the suite counts the TREE (migration files, distinct sp_ RPC
 *      creations) and pins the page's literals to the count. A migration
 *      or RPC that lands without the porch moving FAILS HERE — 5.140's
 *      hand census rotted silently (34 → 30 since; the version token
 *      before that read v5.2.0 for 137 releases).
 *   2. THE WORDING SURVIVES THE TREE — the migration claim speaks the
 *      schema's truth ("one command rebuilds the whole schema"), not the
 *      deployment's ("applied from the CLI" died: 038 sits in the tree
 *      owner-gated and unapplied — the old wording was already half a
 *      lie).
 *   3. THE DERIVED VERSION VOICE — all THREE porch footers (showcase,
 *      help, 404) speak "© 2026 ServePoint · smartPOS · v{APP_VERSION}"
 *      interpolated from version.ts — the free derivation (5.197): the
 *      fact already lives in the tree, the porch just reads it. 5.140's
 *      objection was to a HARDCODED token; a derived one cannot rot, and
 *      the battery pins it.
 *   4. THE VERSION LAW in the agreement shape.
 *
 * Run: bunx vite-node scripts/unit286.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

let n = 0;
const ok = (name) => console.log(`  ok ${++n} - ${name}`);
const strip = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

const showcase = strip('../src/components/pages/ShowcasePage.tsx');
const help = strip('../src/components/pages/IndexHelpPage.tsx');
const notFound = strip('../src/components/pages/NotFoundPage.tsx');
const versionTs = strip('../src/version.ts');
const swJs = strip('../public/sw.js');

/* ── the tree's own census ── */
const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

const spNames = new Set();
for (const f of migrationFiles) {
  const src = readFileSync(new URL(f, migrationsDir), 'utf8');
  for (const m of src.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(sp_[a-z_0-9]+)/gi)) {
    spNames.add(m[1].toLowerCase());
  }
}
const spCount = spNames.size;

/* 1 — the porch's numbers ARE the tree's numbers. */
{
  const num = (k) => {
    const m = showcase.match(new RegExp(`k: '([^']+)', v: '[^']*(?:${k})[^']*'`));
    return m ? m[1] : null;
  };
  const migrationClaim = showcase.match(/k: '(\d+)', v: 'idempotent migrations[^']*'/);
  assert.ok(migrationClaim, 'the migration census card exists');
  assert.equal(migrationClaim[1], String(migrationFiles.length),
    `the porch says ${migrationClaim?.[1]} migrations — the tree holds ${migrationFiles.length}`);
  const rpcClaim = showcase.match(/k: '(\d+)', v: 'guarded RPCs[^']*'/);
  assert.ok(rpcClaim, 'the RPC census card exists');
  assert.equal(rpcClaim[1], String(spCount),
    `the porch says ${rpcClaim?.[1]} guarded RPCs — the tree holds ${spCount} distinct sp_ creations`);
  const mockClaim = showcase.match(/k: '(\d+)', v: 'mock data paths[^']*'/);
  assert.ok(mockClaim && mockClaim[1] === '0', 'the mock-data card still claims zero');
  ok(`the census guard: ${migrationFiles.length} migrations, ${spCount} distinct sp_ RPCs — the porch speaks both`);
}

/* 2 — the wording survives the tree. */
{
  assert.ok(!showcase.includes('applied from the CLI'),
    'the deployment-state wording is extinct — 038 sits in the tree unapplied');
  assert.match(showcase, /k: '37', v: 'idempotent migrations — one command rebuilds the whole schema'/,
    'the migration card names what the tree proves');
  assert.match(showcase, /k: '21', v: 'guarded RPCs — every cloud write passes a database-side guard'/,
    'the RPC card keeps its scope word');
  assert.match(showcase, /k: '0', v: 'mock data paths — every screen reads the live cloud'/,
    'the mock-data card keeps its voice');
  ok('the wording: the schema truth, not the deployment state');
}

/* 3 — the derived version voice on all three porch footers. */
{
  const line = '© 2026 ServePoint · smartPOS · v{APP_VERSION}';
  for (const [name, src] of [['showcase', showcase], ['help', help], ['404 door', notFound]]) {
    assert.ok(src.includes(`import { APP_VERSION } from '../../version';`),
      `${name}: the derivation import`);
    assert.ok(src.includes(line), `${name}: the footer interpolates APP_VERSION`);
    assert.ok(!/© 2026 ServePoint · smartPOS</.test(src),
      `${name}: the bare (rot-prone) line is extinct`);
  }
  ok('the derived version voice: three porch footers, one interpolation, no bare line');
}

/* 4 — the version law, in the agreement shape (born here, not re-anchored:
 *     both sides read and asserted to AGREE — version-agnostic by
 *     construction, the law unit285 had to learn the hard way). */
{
  const v = versionTs.match(/APP_VERSION = '([\d.]+)'/)?.[1];
  const sw = swJs.match(/const VERSION = "servepoint-v([\d.]+)-r1"/)?.[1];
  assert.ok(v && sw, 'both sides carry a version');
  assert.equal(v, sw, 'version.ts and sw.js speak the SAME version');
  ok(`the version law: ${v} on both sides`);
}

console.log(`\nunit286 — ${n} checks green.`);
