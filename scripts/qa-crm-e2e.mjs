// Task 43 QA — migration 016 CRM: trigger engine verification + demo seed.
// Run: node scripts/qa-crm-e2e.mjs
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
const q = (sql, params) => c.query(sql, params);
const ok = (label, cond, detail = '') =>
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);

try {
  await c.connect();

  // ── 1. demo seed: two offers for QR Flow Cafe (idempotent by title) ──────
  const tenant = 'd207be19-e86f-4780-befb-3968831a38fe';
  const loc = (await q(`SELECT id FROM locations WHERE tenant_id=$1 ORDER BY created_at LIMIT 1`, [tenant])).rows[0].id;
  const demo = [
    { title: 'Morning flat white — 10% off', desc: 'Every flat white, 10% lighter on the wallet. All day today.', type: 'percent', val: 10, min: 0 },
    { title: '₹50 off over ₹300', desc: 'Treat the table — orders over ₹300 take ₹50 off.', type: 'flat', val: 50, min: 300 },
  ];
  for (const d of demo) {
    const ex = await q(`SELECT id FROM offers WHERE tenant_id=$1 AND title=$2`, [tenant, d.title]);
    if (ex.rows.length === 0) {
      await q(
        `INSERT INTO offers (tenant_id,title,description,discount_type,discount_value,min_order_amount,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [tenant, d.title, d.desc, d.type, d.val, d.min]
      );
      console.log(`SEED  offer "${d.title}"`);
    } else console.log(`SKIP  offer "${d.title}" (exists)`);
  }

  // ── 2. auto-enrich trigger: an order with a phone books the guest ────────
  const phone = '+919999000111';
  await q(`DELETE FROM orders WHERE customer_phone=$1 AND tenant_id=$2`, [phone, tenant]); // clean slate
  await q(`DELETE FROM customers WHERE tenant_id=$1 AND phone=$2`, [tenant, phone]);
  const ord = (
    await q(
      `INSERT INTO orders (tenant_id,location_id,order_type,status,customer_name,customer_phone,subtotal,tax_amount,discount_amount,total,notes)
       VALUES ($1,$2,'dine_in','new','CRM Trigger Test',$3,200,10,0,210,'qa-crm-fixture') RETURNING id, order_number`,
      [tenant, loc, phone]
    )
  ).rows[0];
  const cust = await q(`SELECT id,name FROM customers WHERE tenant_id=$1 AND phone=$2`, [tenant, phone]);
  ok('auto-enrich: order with phone created the customer row', cust.rows.length === 1, cust.rows[0]?.name);

  // ── 3. ledger stats: paid ⇒ visits 1; unpaid ⇒ 0 ─────────────────────────
  const stats0 = await q(`SELECT visits,total_spent,orders_placed FROM v_customer_stats WHERE tenant_id=$1 AND phone=$2`, [tenant, phone]);
  ok('stats: unpaid ticket ⇒ visits=0, orders_placed=1',
    Number(stats0.rows[0]?.visits) === 0 && Number(stats0.rows[0]?.orders_placed) === 1,
    JSON.stringify(stats0.rows[0]));
  await q(`UPDATE orders SET payment_status='completed', payment_method='upi' WHERE id=$1`, [ord.id]);
  const stats1 = await q(`SELECT visits,total_spent FROM v_customer_stats WHERE tenant_id=$1 AND phone=$2`, [tenant, phone]);
  ok('stats: after payment ⇒ visits=1, spent=210',
    Number(stats1.rows[0]?.visits) === 1 && Number(stats1.rows[0]?.total_spent) === 210,
    JSON.stringify(stats1.rows[0]));

  // ── 4. redemption ledger: usage recomputes + heals ───────────────────────
  const off = (await q(`SELECT id,usage_count FROM offers WHERE tenant_id=$1 AND title=$2`, [tenant, demo[0].title])).rows[0];
  await q(`UPDATE orders SET discount_amount=20, total=190 WHERE id=$1`, [ord.id]);
  await q(`INSERT INTO offer_redemptions (tenant_id,offer_id,order_id,discount_amount) VALUES ($1,$2,$3,20)`, [tenant, off.id, ord.id]);
  const u1 = (await q(`SELECT usage_count FROM offers WHERE id=$1`, [off.id])).rows[0].usage_count;
  ok('redemption insert ⇒ usage_count recomputed to 1', Number(u1) === 1, String(u1));
  // replay-proof: second redemption for the same order must violate UNIQUE
  let replayBlocked = false;
  try {
    await q(`INSERT INTO offer_redemptions (tenant_id,offer_id,order_id,discount_amount) VALUES ($1,$2,$3,20)`, [tenant, off.id, ord.id]);
  } catch (e) { replayBlocked = /duplicate key|unique/i.test(e.message); }
  ok('replay-proof: second redemption per order rejected', replayBlocked);
  // cascade heal: delete the order ⇒ redemption cascades ⇒ usage heals to 0
  await q(`DELETE FROM orders WHERE id=$1`, [ord.id]);
  const reds = await q(`SELECT count(*)::int n FROM offer_redemptions WHERE offer_id=$1`, [off.id]);
  const u2 = (await q(`SELECT usage_count FROM offers WHERE id=$1`, [off.id])).rows[0].usage_count;
  ok('cascade heal: order deleted ⇒ ledger empty + usage_count back to 0',
    reds.rows[0].n === 0 && Number(u2) === 0, `ledger=${reds.rows[0].n} usage=${u2}`);

  // ── 5. cleanup CRM fixture identity ──────────────────────────────────────
  await q(`DELETE FROM customers WHERE tenant_id=$1 AND phone=$2`, [tenant, phone]);
  const gone = await q(`SELECT count(*)::int n FROM customers WHERE tenant_id=$1 AND phone=$2`, [tenant, phone]);
  ok('cleanup: fixture guest removed', gone.rows[0].n === 0);

  // ── 6. final state ───────────────────────────────────────────────────────
  const offs = await q(`SELECT title,discount_type,discount_value,min_order_amount,is_active,usage_count FROM offers WHERE tenant_id=$1 ORDER BY created_at`, [tenant]);
  console.log('\nOFFERS NOW:', JSON.stringify(offs.rows, null, 1));
  const custs = await q(`SELECT count(*)::int n FROM customers WHERE tenant_id=$1`, [tenant]);
  console.log(`CUSTOMERS NOW: ${custs.rows[0].n}`);
  console.log('\nCRM ENGINE E2E COMPLETE');
} catch (e) {
  console.error('ABORT:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
