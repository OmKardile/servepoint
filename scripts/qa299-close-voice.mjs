// qa299 — the close hears the voice: the round's real-execution proof.
//
// The tenant UI wall (QR owner password — the carried owner item) keeps the
// Close-out screen out of browser reach, so the Z's new block is proven the
// 295/296/297/298 way: THE SHIPPED BUILDER (buildZReportText, imported from
// the component file exactly as the unit battery does) executed against the
// REAL ledger through the admin RLS. The proof: the day's ratings read from
// order_feedback, the voice assembled by the SHIPPED guestVoice law, the
// Z's print bytes shown — the block present, word centered, silence and
// absence both exercised.
//
import { createClient } from '@supabase/supabase-js';
import { appDayKey } from '../src/lib/appday.ts';
import { buildZReportText } from '../src/components/eod/EodScreen.tsx';
import { guestVoice } from '../src/lib/verdict.ts';

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

let fails = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) fails++;
};

// The day the voice landed: derived from the newest feedback row via the
// SHIPPED day grammar (appDayKey — the ONE day key). The family's own
// verdict crossed IST midnight (18:30:37 UTC = 00:00:37 IST), so the day
// is read from the ledger, never guessed.
const newest = await db.from('order_feedback').select('rating, created_at')
  .order('created_at', { ascending: false }).limit(1).maybeSingle();
if (newest.error || !newest.data) { console.error('voice read refused:', newest.error?.message || 'no rows'); process.exit(3); }
const DAY = appDayKey(newest.data.created_at);
console.log(`the day the voice landed: ${DAY} (appDayKey of the newest rating)`);
const startIso = `${DAY}T00:00:00+05:30`;
const endIso = `${DAY}T24:00:00+05:30`;

// the tenant id first (the reads below are tenant-scoped the way the
// Close-out's own reads are)
const seed = await db.from('orders').select('tenant_id').eq('order_number', 131).maybeSingle();
if (seed.error || !seed.data) { console.error('#131 read refused:', seed.error?.message || 'no row'); process.exit(3); }
const tenantId = seed.data.tenant_id;

const [oRes, pRes, fRes] = await Promise.all([
  db.from('orders').select('id, order_number, status, total, tax_amount, payment_status, discount_amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', startIso).lt('created_at', endIso),
  db.from('payments').select('method, amount, created_at')
    .gte('created_at', startIso).lt('created_at', endIso),
  db.from('order_feedback').select('rating')
    .eq('tenant_id', tenantId)
    .gte('created_at', startIso).lt('created_at', endIso),
]);
if (oRes.error || pRes.error || fRes.error) {
  console.error('LEDGER read refused:', oRes.error?.message || pRes.error?.message || fRes.error?.message);
  process.exit(3);
}

const dayOrders = oRes.data ?? [];
const dayPayments = pRes.data ?? [];
const dayVoice = fRes.data ?? [];
console.log(`the day holds ${dayOrders.length} ticket(s) and ${dayVoice.length} rating row(s) — a voice can land on a day with no new tickets (the verdict crossed IST midnight); the close speaks both honestly`);
check(dayVoice.length > 0, `the day's voice — ${dayVoice.length} rating row(s) read`);

// The voice, assembled by the SHIPPED law (what buildZOpts hands the builder).
const v = guestVoice(dayVoice.map((r) => ({ rating: Number(r.rating) })));
check(!!v, `guestVoice speaks — count ${v?.count} · avg ${v?.avg.toFixed(2)} · word "${v?.tone.word}"`);

const guests = {
  count: dayVoice.length,
  avg: v ? Math.round(v.avg * 10) / 10 : 0,
  word: v ? v.tone.word : '',
  low: dayVoice.filter((r) => Number(r.rating) <= 2).length,
};

// Independent cross-check of the average (the ledger's own arithmetic).
const indepAvg = dayVoice.reduce((s, r) => s + Number(r.rating), 0) / dayVoice.length;
check(Math.abs(indepAvg - guests.avg) < 0.051, `the shipped law agrees with the ledger's own arithmetic (${indepAvg.toFixed(2)} ≈ ${guests.avg})`);

// The Z opts, the money blocks assembled from the SAME day reads (the
// builder consumes; the guests block is the proof's subject).
const live = dayOrders.filter((o) => o.status !== 'cancelled');
const gross = live.reduce((s, o) => s + Number(o.total || 0), 0);
const gst = live.reduce((s, o) => s + Number(o.tax_amount || 0), 0);
const paid = dayPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
const mixMap = new Map();
dayPayments.forEach((p) => mixMap.set(String(p.method).toUpperCase(), (mixMap.get(String(p.method).toUpperCase()) || 0) + Number(p.amount)));

const base = {
  storeName: 'CheeseBurg',
  dateIso: DAY,
  orders: live.length,
  cancelled: dayOrders.length - live.length,
  gross,
  gst,
  paid,
  unpaid: Math.max(0, gross - paid),
  unpaidTickets: live.filter((o) => o.payment_status !== 'completed').length,
  cogs: 0,
  margin: gross,
  mix: [...mixMap.entries()].map(([method, amount]) => ({ method, amount })),
  printedBy: 'qa299',
};

const z = buildZReportText({ ...base, guests });
console.log(`\n----- the Z's own bytes, ${DAY} -----`);
console.log(z);
console.log('--------------------------------------');

check(z.includes('THE GUESTS · VOICE'), 'the close speaks THE GUESTS · VOICE');
const gIdx = z.indexOf('THE GUESTS · VOICE');
const fIdx = z.indexOf('THE FLOOR · ROUNDS');
check(fIdx === -1 || (fIdx < gIdx && z.indexOf('CASH DRAWER') > gIdx),
  'the seat: after the floor block, before the drawer');
check(new RegExp(`Ratings\\s+${guests.count} · avg ${guests.avg.toFixed(1)}`).test(z),
  `the row speaks count + avg verbatim ("${guests.count} · avg ${guests.avg.toFixed(1)}")`);
check(z.split('\n').some((l) => l.trim() === guests.word), `the tone word is the centered stamp ("${guests.word}")`);
check(guests.low === 0 ? !z.includes('Low ratings') : z.includes('Low ratings (2 or less)'),
  "the bell's line rides exactly when it rang");

// The silence: a verified empty day speaks the floor's own zero-language.
const zQuiet = buildZReportText({ ...base, guests: { count: 0, avg: 0, word: '', low: 0 } });
check(zQuiet.includes('Ratings: none - quiet'), 'a verified quiet day reads "none - quiet"');
check(!zQuiet.includes('guests love it') && !zQuiet.includes('listen up'),
  'no tone word on a quiet day — the silence is wordless');

// The absence: no field, no block, no byte moved (the old shapes hold).
const zOld = buildZReportText(base);
check(!zOld.includes('THE GUESTS'), 'an unread day prints NOTHING — the Z never claims a quiet it did not verify');

console.log(fails === 0 ? `\nqa299: ALL PASS` : `\nqa299: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
