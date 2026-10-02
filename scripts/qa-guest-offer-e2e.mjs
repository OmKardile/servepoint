// Task 46 QA — migration 017 guest offer checkout: engine E2E.
// Calls the RPCs AS THE ANON ROLE (the real guest privilege path).
// Run: node scripts/qa-guest-offer-e2e.mjs
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

const asAnon = async (params) => {
  await q('SET LOCAL ROLE anon');
  const r = await q(
    `SELECT sp_create_public_order($1,$2,$3,$4,$5,$6,$7,$8::uuid) AS res`,
    params,
  );
  await q('RESET ROLE');
  return r.rows[0].res;
};

const createArgs = (o) => [
  o.qrToken, o.tableNumber, o.items, 'dine_in',
  o.customerName ?? null, o.notes ?? null, o.clientOpId, o.offerId ?? null,
];

const trackAnon = async (orderId) => {
  await q('SET LOCAL ROLE anon');
  const r = await q('SELECT sp_get_public_order($1::uuid) AS res', [orderId]);
  await q('RESET ROLE');
  return r.rows[0].res;
};

try {
  await c.connect();

  // ── fixtures (resolve by name — no hardcoded UUIDs) ───────────────────────
  const tenant = 'd207be19-e86f-4780-befb-3968831a38fe';
  const tbl = (await q(
    `SELECT dt.qr_token, dt.table_number FROM dining_tables dt
     WHERE dt.tenant_id=$1 ORDER BY dt.table_number LIMIT 1`, [tenant])).rows[0];
  const item = (await q(
    `SELECT id, name, price FROM menu_items WHERE tenant_id=$1 AND name='Flat White'`, [tenant])).rows[0];
  const variant = (await q(
    `SELECT id, name, price_delta FROM menu_variants WHERE menu_item_id=$1 AND name='Large'`, [item.id])).rows[0];
  const addon = (await q(
    `SELECT a.id, a.name, a.price FROM addons a WHERE a.tenant_id=$1 AND a.name='Extra shot'`, [tenant])).rows[0];
  const offerFlat = (await q(
    `SELECT id, title FROM offers WHERE tenant_id=$1 AND title='₹50 off over ₹300'`, [tenant])).rows[0];
  const offerPct = (await q(
    `SELECT id, title FROM offers WHERE tenant_id=$1 AND title='Morning flat white — 10% off'`, [tenant])).rows[0];
  ok('fixtures resolved', !!(tbl && item && variant && addon && offerFlat && offerPct),
    `T=${tbl.table_number} ${item.name} ₹${item.price} / ${variant.name} +${variant.price_delta} / ${addon.name} +${addon.price}`);

  const items330 = JSON.stringify([
    { menu_item_id: item.id, variant_id: variant.id, qty: 1, notes: null, addon_ids: [addon.id] },
  ]);
  const items220 = JSON.stringify([{ menu_item_id: item.id, variant_id: null, qty: 1, notes: null, addon_ids: [] }]);

  // ── 1. flat offer: 330 subtotal → −50 → GST 14 → 294 ─────────────────────
  let res = await asAnon(createArgs({ qrToken: tbl.qr_token, tableNumber: tbl.table_number, items: items330,
    customerName: 'QA Offer Guest', notes: 'qa-017', clientOpId: `qa017-${Date.now()}`, offerId: offerFlat.id }));
  ok('flat offer accepted', res.is_valid === true, JSON.stringify(res.order || res));
  const ord1 = res.order;
  const db1 = (await q(`SELECT subtotal, discount_amount, tax_amount, total FROM orders WHERE id=$1`, [ord1.id])).rows[0];
  ok('money: 330/−50/GST 14/294', Number(db1.subtotal) === 330 && Number(db1.discount_amount) === 50
    && Number(db1.tax_amount) === 14 && Number(db1.total) === 294,
    `sub=${db1.subtotal} disc=${db1.discount_amount} gst=${db1.tax_amount} tot=${db1.total}`);
  const red1 = (await q(
    `SELECT r.discount_amount, o.usage_count FROM offer_redemptions r
     JOIN offers o ON o.id=r.offer_id WHERE r.order_id=$1`, [ord1.id])).rows[0];
  ok('redemption ledger row + usage recompute', !!red1 && Number(red1.discount_amount) === 50 && red1.usage_count >= 1,
    `disc=${red1?.discount_amount} usage=${red1?.usage_count}`);

  // ── 2. track projection exposes discount + title ─────────────────────────
  let trk = await trackAnon(ord1.id);
  const o1 = trk.order;
  ok('track shows discount row', Number(o1.discount_amount) === 50 && o1.offer_title === offerFlat.title,
    `disc=${o1.discount_amount} title=${o1.offer_title} tot=${o1.total}`);

  // ── 3. percent offer: 220 → −22 → GST 9.90 → 207.90 ──────────────────────
  res = await asAnon(createArgs({ qrToken: tbl.qr_token, tableNumber: tbl.table_number, items: items220,
    customerName: 'QA Pct Guest', notes: 'qa-017', clientOpId: `qa017p-${Date.now()}`, offerId: offerPct.id }));
  const ord2 = res.order;
  const db2 = (await q(`SELECT subtotal, discount_amount, tax_amount, total FROM orders WHERE id=$1`, [ord2.id])).rows[0];
  ok('percent money: 220/−22/GST 9.90/207.90', Number(db2.discount_amount) === 22
    && Number(db2.tax_amount) === 9.9 && Number(db2.total) === 207.9,
    `disc=${db2.discount_amount} gst=${db2.tax_amount} tot=${db2.total}`);

  // ── 4. below floor → OFFER_MIN, ZERO residue ──────────────────────────────
  const before = (await q(`SELECT count(*)::int AS n FROM orders WHERE tenant_id=$1`, [tenant])).rows[0].n;
  res = await asAnon(createArgs({ qrToken: tbl.qr_token, tableNumber: tbl.table_number, items: items220,
    customerName: null, notes: 'qa-017', clientOpId: `qa017min-${Date.now()}`, offerId: offerFlat.id }));
  const after = (await q(`SELECT count(*)::int AS n FROM orders WHERE tenant_id=$1`, [tenant])).rows[0].n;
  ok('below floor rejected', res.is_valid === false && res.error === 'OFFER_MIN', res.message || '');
  ok('reject left zero residue', before === after, `${before} → ${after}`);

  // ── 5. paused offer → OFFER_INVALID ───────────────────────────────────────
  await q(`UPDATE offers SET is_active=false WHERE id=$1`, [offerPct.id]);
  res = await asAnon(createArgs({ qrToken: tbl.qr_token, tableNumber: tbl.table_number, items: items220,
    customerName: null, notes: 'qa-017', clientOpId: `qa017pa-${Date.now()}`, offerId: offerPct.id }));
  await q(`UPDATE offers SET is_active=true WHERE id=$1`, [offerPct.id]);
  ok('paused offer rejected', res.is_valid === false && res.error === 'OFFER_INVALID', res.message || '');

  // ── 6. no-offer path still works + discount 0 ────────────────────────────
  res = await asAnon(createArgs({ qrToken: tbl.qr_token, tableNumber: tbl.table_number, items: items220,
    customerName: null, notes: 'qa-017', clientOpId: `qa017no-${Date.now()}`, offerId: null }));
  const db3 = (await q(`SELECT discount_amount, tax_amount, total FROM orders WHERE id=$1`, [res.order.id])).rows[0];
  ok('no-offer path unchanged', res.is_valid && Number(db3.discount_amount) === 0
    && Number(db3.tax_amount) === 11 && Number(db3.total) === 231,
    `disc=${db3.discount_amount} gst=${db3.tax_amount} tot=${db3.total}`);

  // ── 7. replay returns the SAME discounted ticket ─────────────────────────
  const dupId = `qa017dup-${Date.now()}`;
  res = await asAnon(createArgs({ qrToken: tbl.qr_token, tableNumber: tbl.table_number, items: items330,
    customerName: 'QA Dup', notes: 'qa-017', clientOpId: dupId, offerId: offerFlat.id }));
  const first = res.order;
  res = await asAnon(createArgs({ qrToken: tbl.qr_token, tableNumber: tbl.table_number, items: items330,
    customerName: 'QA Dup', notes: 'qa-017', clientOpId: dupId, offerId: offerFlat.id }));
  ok('replay is the same ticket', res.duplicate === true && res.order?.id === first.id,
    `dup=${res.duplicate} id_match=${res.order?.id === first.id}`);

  // ── cleanup: delete QA orders (cascade heals usage via trigger) ──────────
  const del = await q(
    `DELETE FROM orders WHERE id = ANY($1::uuid[]) RETURNING id`,
    [[ord1.id, ord2.id, res.order.id, first.id].filter((v, i, a) => a.indexOf(v) === i)],
  );
  const heal = (await q(
    `SELECT usage_count FROM offers WHERE id=$1`, [offerFlat.id])).rows[0].usage_count;
  ok('cleanup + usage healed', del.rowCount >= 3 && heal === 2, `deleted=${del.rowCount} flat usage back to demo=${heal}`);

  console.log('\nDONE');
} catch (e) {
  console.error('FAILED:', e.message, '\n', e.stack);
  process.exitCode = 1;
} finally {
  await c.end();
}
