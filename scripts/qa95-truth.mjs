// Task 95 — read-only truth: order #109's order_item_addons rows prove the
// counter door now writes the frozen extras the guest door always did.
// Run: SUPABASE_DB_PASSWORD='...' node scripts/qa95-truth.mjs
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

const REF = 'gehjsxopcowmotgrrcgc';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
};

await c.connect();
try {
  const { rows: orders } = await c.query(
    `SELECT id, order_number, status, subtotal, tax_amount, discount_amount, total, customer_phone
       FROM orders WHERE tenant_id = $1 AND order_number = 109`, [TENANT]);
  ok('order #109 exists', orders.length === 1);
  const o = orders[0];
  ok('#109 cancelled (clean exit)', o.status === 'cancelled', `status=${o.status}`);
  ok('#109 money exact (330 + 16.50 GST)', Number(o.subtotal) === 330 && Number(o.tax_amount) === 16.5 && Number(o.total) === 346.5,
    `sub=${o.subtotal} tax=${o.tax_amount} total=${o.total}`);

  const { rows: items } = await c.query(
    `SELECT id, name, qty, unit_price, variant_name FROM order_items WHERE order_id = $1`, [o.id]);
  ok('#109 has 1 line', items.length === 1);
  const it = items[0];
  ok('line is Flat White · Large @ ₹330 (frozen FULL price)', it.name === 'Flat White' && it.variant_name === 'Large' && Number(it.unit_price) === 330,
    `${it.name} · ${it.variant_name} @ ${it.unit_price}`);

  const { rows: addons } = await c.query(
    `SELECT addon_id, name, price FROM order_item_addons WHERE order_item_id = $1`, [it.id]);
  ok('LEDGER WRITE: 1 order_item_addons row on the counter ticket', addons.length === 1, JSON.stringify(addons));
  ok('extra is Extra shot @ ₹60 (real price, not 0)', addons[0]?.name === 'Extra shot' && Number(addons[0]?.price) === 60,
    addons[0] ? `${addons[0].name} @ ${addons[0].price}` : 'none');

  const { rows: gates } = await c.query(
    `SELECT door, count(*)::int AS n FROM (
       SELECT 'guest_door_pre_existing' AS door FROM order_item_addons x
         JOIN order_items oi ON oi.id = x.order_item_id
        WHERE oi.tenant_id = $1 AND oi.order_id <> $2
     ) t GROUP BY door`, [TENANT, o.id]);
  console.log(`  INFO other tickets' addon rows (guest-door era): ${gates[0]?.n ?? 0}`);

  const { rows: census } = await c.query(
    `SELECT (SELECT count(*)::int FROM orders WHERE tenant_id = $1) AS orders,
            (SELECT count(*)::int FROM menu_items WHERE tenant_id = $1) AS menu,
            (SELECT count(*)::int FROM notifications WHERE tenant_id = $1) AS bells,
            (SELECT count(*)::int FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = $1)) AS chat,
            (SELECT count(*)::int FROM storage.objects WHERE bucket_id = 'menu-photos') AS bucket,
            (SELECT count(*)::int FROM customers WHERE tenant_id = $1) AS guests`, [TENANT]);
  console.log('  TRUTH', JSON.stringify(census[0]));
  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exitCode = fail > 0 ? 1 : 0;
} finally {
  await c.end();
}
