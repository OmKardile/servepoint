// Task 50 — guest feedback E2E on the live cloud (migration 019).
// Self-cleaning fixture order; RPCs exercised AS anon (SET LOCAL ROLE),
// RLS lockout proven by direct anon attempts. Run: node scripts/qa-feedback-e2e.mjs
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

try {
  await c.connect();

  const T = 'd207be19-e86f-4780-befb-3968831a38fe'; // QR Flow Cafe
  let orderId = null;

  // ── fixture: one self-cleaning order (018 lessons: omit order_number, subselect location) ──
  await c.query('BEGIN');
  const ins = await c.query(
    `INSERT INTO orders (tenant_id, location_id, order_type, status, payment_status, customer_name, subtotal, tax_amount, total)
     VALUES ($1, (SELECT id FROM locations WHERE tenant_id = $1 LIMIT 1),
             'dine_in', 'completed', 'completed', 'zz-feedback-fixture', 100, 5, 105)
     RETURNING id`,
    [T],
  );
  orderId = ins.rows[0].id;
  await c.query('COMMIT');

  // commit=true: BEGIN/SET LOCAL/COMMIT — writes persist (role reverts on commit)
  // commit=false: BEGIN/SET LOCAL/ROLLBACK — for attempts that must NOT persist
  const asAnon = async (fn, commit = true) => {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE anon');
    let out;
    try {
      out = await fn();
    } catch (e) {
      out = { threw: e };
    }
    await c.query(commit ? 'COMMIT' : 'ROLLBACK');
    return out;
  };

  // ── 1. valid submit as anon ────────────────────────────────────────────────
  console.log('1) valid submit (anon, rating 4 + comment)');
  const r1 = await asAnon(() =>
    c.query(`SELECT sp_submit_public_feedback($1, 4, '  Lovely flat white  ') AS r`, [orderId]),
  );
  const v1 = r1.threw ? null : r1.rows[0].r;
  ok(v1?.is_valid === true, 'RPC accepts a valid rating', JSON.stringify(v1));
  const row1 = await c.query(`SELECT rating, comment, tenant_id FROM order_feedback WHERE order_id = $1`, [orderId]);
  ok(row1.rows.length === 1, 'exactly one ledger row');
  ok(row1.rows[0]?.rating === 4, 'rating stored as 4');
  ok(row1.rows[0]?.comment === 'Lovely flat white', 'comment trimmed', JSON.stringify(row1.rows[0]?.comment));
  ok(row1.rows[0]?.tenant_id === T, 'tenant_id copied from the order');

  // ── 2. replay is silent ────────────────────────────────────────────────────
  console.log('2) replay guard');
  const r2 = await asAnon(() =>
    c.query(`SELECT sp_submit_public_feedback($1, 5, 'again') AS r`, [orderId]),
  );
  const v2 = r2.threw ? null : r2.rows[0].r;
  ok(v2?.is_valid === false && v2?.error === 'ALREADY', 'second submit returns ALREADY', JSON.stringify(v2));
  const cnt2 = await c.query(`SELECT count(*)::int AS n FROM order_feedback WHERE order_id = $1`, [orderId]);
  ok(cnt2.rows[0].n === 1, 'still exactly one row (rating unchanged)');

  // ── 3. shape validation ────────────────────────────────────────────────────
  console.log('3) shape validation');
  for (const bad of [0, 6, null]) {
    const r = await asAnon(() =>
      c.query(`SELECT sp_submit_public_feedback($1, $2, NULL)::text AS r`, [orderId, bad]),
    );
    const v = r.threw ? null : JSON.parse(r.rows[0].r);
    ok(v?.error === 'ALREADY' || v?.error === 'BAD_RATING',
       `rating ${JSON.stringify(bad)} rejected`, JSON.stringify(v));
  }
  const long = 'x'.repeat(281);
  const r3 = await asAnon(() =>
    c.query(`SELECT sp_submit_public_feedback($1, 5, $2)::text AS r`, [orderId, long]),
  );
  const v3 = r3.threw ? null : JSON.parse(r3.rows[0].r);
  ok(v3?.error === 'ALREADY' || v3?.error === 'TOO_LONG', '281-char comment rejected', JSON.stringify(v3));

  // ── 4. unknown order ───────────────────────────────────────────────────────
  console.log('4) unknown order');
  const r4 = await asAnon(() =>
    c.query(`SELECT sp_submit_public_feedback(gen_random_uuid(), 5, NULL)::text AS r`),
  );
  const v4 = r4.threw ? null : JSON.parse(r4.rows[0].r);
  ok(v4?.error === 'NOT_FOUND', 'random UUID → NOT_FOUND', JSON.stringify(v4));

  // ── 5. pager exposes the rating ────────────────────────────────────────────
  console.log('5) sp_get_public_order exposes feedback_rating');
  const r5 = await asAnon(() =>
    c.query(`SELECT sp_get_public_order($1) AS r`, [orderId]),
  );
  const v5 = r5.threw ? null : r5.rows[0].r;
  ok(v5?.is_valid === true && v5?.order?.feedback_rating === 4,
     'track projection carries feedback_rating=4', JSON.stringify(v5?.order?.feedback_rating));
  // an unrated order reads null, not missing
  const r5b = await asAnon(() =>
    c.query(`SELECT sp_get_public_order((SELECT id FROM orders WHERE order_number = 48 LIMIT 1)) AS r`),
  );
  const v5b = r5b.threw ? null : r5b.rows[0].r;
  ok(v5b?.is_valid === true && v5b?.order?.feedback_rating === null,
     'unrated order → feedback_rating null');

  // ── 6. anon cannot touch the table directly (RLS deny-by-default) ─────────
  console.log('6) RLS lockout');
  const w = await asAnon(
    () => c.query(`INSERT INTO order_feedback (tenant_id, order_id, rating) VALUES ($1, $2, 5)`, [T, orderId]),
    false,
  );
  ok(!!w.threw, 'anon direct INSERT blocked', w.threw ? String(w.threw.message).slice(0, 60) : 'NO ERROR');
  const s = await asAnon(() => c.query(`SELECT count(*)::int AS n FROM order_feedback`), false);
  ok(!!s.threw || s.rows[0].n === 0, 'anon direct SELECT blocked', s.threw ? String(s.threw.message).slice(0, 60) : `rows=${s.rows[0].n}`);
} catch (e) {
  fail += 1;
  console.error('FATAL:', e.message);
} finally {
  // fixture order deleted → feedback cascades
  try {
    await c.query(`DELETE FROM order_feedback WHERE order_id IN (SELECT id FROM orders WHERE customer_name = 'zz-feedback-fixture')`);
    await c.query(`DELETE FROM orders WHERE customer_name = 'zz-feedback-fixture'`);
    const left = await c.query(`SELECT count(*)::int AS n FROM order_feedback`);
    console.log(`CLEANUP: feedback rows remaining = ${left.rows[0].n}`);
    await c.end();
  } catch (e) {
    console.error('CLEANUP FAILED:', e.message);
    process.exitCode = 1;
  }
}
console.log(`\nRESULT: ${pass} pass / ${fail} fail`);
process.exitCode = fail === 0 ? 0 : 1;
