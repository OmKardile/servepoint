// Task 75 — 027 stock diary verification: DB truth + RPC guard probes as the
// OWNER's own JWT (exactly the browser's path — same anon key, same auth).
//   1. DB TRUTH — exactly 2 stock_adjustments rows from the E2E (spillage −50
//      with note, delivery +50), stock honestly back at 4,900 (net zero).
//   2. NEGATIVE — bad reason refused (BAD_REASON).
//   3. NEGATIVE — delivery with a negative qty refused (DELIVERY_MUST_BE_POSITIVE).
//   4. NEGATIVE — waste reason with a positive qty refused (WASTE_MUST_BE_NEGATIVE).
//   5. NEGATIVE — an unknown/foreign ingredient id refused (NOT_FOUND).
// All probes are refusals — nothing is written. Run: node scripts/qa75-diary.mjs
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const URL = 'https://gehjsxopcowmotgrrcgc.supabase.co';
const ANON = 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32';
const EMAIL = 'qrowner@qrflowcafe.in';
const PW = 'x^*rGYEzwF$xqH_6';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';

const sb = createClient(URL, ANON);
const auth = await sb.auth.signInWithPassword({ email: EMAIL, password: PW });
if (auth.error) {
  console.error('AUTH FAILED:', auth.error.message);
  process.exit(1);
}
console.log('AUTH OK: uid', auth.data.user.id);

// ── 1. DB truth (direct pg, read-only) ───────────────────────────────────────
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.gehjsxopcowmotgrrcgc`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const rows = await c.query(
  `SELECT sa.qty, sa.reason, sa.note, sa.created_by_email, ii.name
     FROM stock_adjustments sa JOIN inventory_items ii ON ii.id = sa.inventory_item_id
    WHERE sa.tenant_id = $1 ORDER BY sa.created_at DESC`,
  [TENANT],
);
console.log(`DB: ${rows.rowCount} stock_adjustments row(s) for the tenant`);
let ok = true;
for (const r of rows.rows) {
  console.log(`   ${r.name}: ${r.qty} ${r.reason} note="${r.note}" by=${r.created_by_email}`);
}
const spill = rows.rows.find((r) => r.reason === 'spillage');
const deliv = rows.rows.find((r) => r.reason === 'delivery');
if (!spill || Number(spill.qty) !== -50 || spill.note !== 'QA round 75 — spill tap test') {
  console.error('DB MISMATCH: spillage row wrong'); ok = false;
}
if (!deliv || Number(deliv.qty) !== 50) {
  console.error('DB MISMATCH: delivery row wrong'); ok = false;
}
if (!rows.rows.every((r) => r.created_by_email === EMAIL)) {
  console.error('DB MISMATCH: created_by_email not stamped'); ok = false;
}
const stock = await c.query(
  `SELECT current_stock FROM inventory_items
    WHERE tenant_id = $1 AND name = 'Coffee beans'`,
  [TENANT],
);
const level = Number(stock.rows[0].current_stock);
console.log(`DB: Coffee beans current_stock = ${level} ${level === 4900 ? '(net zero ✓)' : '(UNEXPECTED)'}`);
if (level !== 4900) ok = false;

// ── 2-5. RPC guard probes as the owner's JWT (refusals — nothing written) ────
const beans = await c.query(
  `SELECT id FROM inventory_items WHERE tenant_id = $1 AND name = 'Coffee beans'`,
  [TENANT],
);
const beansId = beans.rows[0].id;
await c.end();

const probe = async (label, id, qty, reason, want) => {
  const { error } = await sb.rpc('sp_adjust_stock', {
    p_inventory_item_id: id, p_qty: qty, p_reason: reason, p_note: '',
  });
  const got = error ? String(error.message) : 'UNEXPECTEDLY SUCCEEDED';
  const hit = error && got.includes(want);
  console.log(`${hit ? 'GUARD OK' : 'GUARD FAIL'}: ${label} → ${got.slice(0, 80)}`);
  if (!hit) process.exitCode = 1;
};
await probe('bad reason "vibes"', beansId, 1, 'vibes', 'BAD_REASON');
await probe('delivery with negative qty', beansId, -10, 'delivery', 'DELIVERY_MUST_BE_POSITIVE');
await probe('spoilage with positive qty', beansId, 10, 'spoilage', 'WASTE_MUST_BE_NEGATIVE');
await probe('foreign ingredient id', crypto.randomUUID(), 5, 'correction', 'NOT_FOUND');
console.log(ok ? 'DB TRUTH OK' : 'DB TRUTH FAILED');
