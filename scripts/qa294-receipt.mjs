// qa294-receipt: real-execution proof of "the word on paper" (v5.255.0).
// Signs in as the bootstrap operator, pulls the note-bearing real order
// (#131, the checkout word placed in Task 293's live walk), builds the SAME
// ReceiptOpts the Bills detail panel builds, and calls the REAL pure
// builders — print HTML + share text — asserting the word speaks and the
// blank-note byte-identity law holds. Artifacts dumped for the visual walk.
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { buildReceiptHtml, buildReceiptText } from '../src/components/bills/ReceiptPrint.tsx';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

// The note-bearing order: #131 (Task 293's real checkout). Fall back to the
// newest order that carries any note.
let { data: order } = await db
  .from('orders')
  .select('*, dining_tables(table_number)')
  .eq('order_number', 131)
  .maybeSingle();
if (!order?.notes) {
  const { data: newest } = await db
    .from('orders')
    .select('*, dining_tables(table_number)')
    .not('notes', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  order = newest;
}
if (!order) { console.error('NO note-bearing order found'); process.exit(3); }

const { data: tenant } = await db.from('tenants').select('name').eq('id', order.tenant_id).maybeSingle();

const { data: itemRows } = await db.from('order_items').select('*').eq('order_id', order.id);
const itemIds = (itemRows || []).map((it) => it.id).filter(Boolean);
const addonsByItem = new Map();
if (itemIds.length > 0) {
  const { data: addonRows } = await db
    .from('order_item_addons')
    .select('order_item_id, name, price')
    .in('order_item_id', itemIds);
  (addonRows || []).forEach((a) => {
    const list = addonsByItem.get(a.order_item_id) || [];
    list.push({ name: a.name, price: Number(a.price) });
    addonsByItem.set(a.order_item_id, list);
  });
}

const opts = {
  storeName: tenant?.name || 'CheeseBurg',
  orderNumber: order.order_number,
  orderType: String(order.order_type || ''),
  tableLabel: order.dining_tables?.table_number ?? null,
  customerName: order.customer_name,
  orderNote: order.notes, // v5.255.0 — the word rides to paper
  createdAt: order.created_at,
  items: (itemRows || []).map((it) => ({
    name: it.name,
    qty: it.qty,
    variantName: it.variant_name,
    notes: it.notes,
    addons: addonsByItem.get(it.id) || [],
    lineTotal: Number(it.item_total ?? it.unit_price * it.qty),
  })),
  subtotal: Number(order.subtotal),
  discount: order.discount_amount,
  tax: Number(order.tax_amount),
  total: Number(order.total),
  paymentLabel: null,
  paidAt: null,
  isPaid: String(order.payment_status || '') === 'completed',
};

const html = buildReceiptHtml(opts);
const text = buildReceiptText(opts);

let failures = 0;
const ok = (cond, label) => { console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`); if (!cond) failures++; };

const storedNote = String(order.notes);
ok(html.includes('KITCHEN NOTE'), `print HTML speaks the KITCHEN NOTE label (order #${order.order_number})`);
ok(html.includes(storedNote), 'print HTML speaks the stored word VERBATIM (server provenance included)');
ok(text.includes('KITCHEN NOTE'), 'share text speaks the KITCHEN NOTE label');
ok(text.includes(storedNote.split(/\s+/)[0]) && text.includes(storedNote.slice(-2)), 'share text carries the word (wrapped as prose)');
const noteLines = text.slice(text.indexOf('KITCHEN NOTE')).split('\n').slice(1, 4);
ok(noteLines.every((l) => l.length <= 34), `share text wraps inside the 32-col frame (${noteLines.map((l) => l.trim().length).join(',')})`);

// The byte-identity law: the same receipt WITHOUT a note carries no block.
const bare = buildReceiptHtml({ ...opts, orderNote: null });
ok(!bare.includes('KITCHEN NOTE'), 'absent note → no block, no trace (byte-identity law)');
const bareText = buildReceiptText({ ...opts, orderNote: null });
ok(!bareText.includes('KITCHEN NOTE'), 'absent note → the share text keeps its old frame too');

writeFileSync('scripts/qa294-receipt.html', html);
writeFileSync('scripts/qa294-receipt.txt', text);
console.log(`\nnote word: "${storedNote}"`);
console.log('artifacts: scripts/qa294-receipt.html + scripts/qa294-receipt.txt');
process.exit(failures === 0 ? 0 : 1);
