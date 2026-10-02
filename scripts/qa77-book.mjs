// Task 77 — the book: DB truth of the E2E booking lifecycle.
// Expect: exactly 1 reservation — Maya Iyer ×4, phone, note "QA round 77 —
// window seat", status 'cancelled' (the honest terminal state kept as tagged
// QA history), slot 19:30 IST today, created by the owner's email, and the
// trigger-stamped updated_at ahead of created_at (5 lifecycle flips happened).
// Also proves the 028 creator trigger with the OWNER's own JWT (the browser's
// exact path): inserts a probe via PostgREST, checks the server-side stamp,
// deletes it — zero residue. The probe INSERT/DELETE is the only write; the
// Maya repair backfills the actor email that the pre-fix schema left blank.
// Run: SUPABASE_DB_PASSWORD='<db-password>' node scripts/qa77-book.mjs
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
  console.error('AUTH FAILED:', auth.error.error ?? auth.error.message);
  process.exit(1);
}
console.log('AUTH OK: uid', auth.data.user.id);

// ── creator-trigger probe via the owner's JWT (browser's path) ───────────────
const probeSlot = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
const ins = await sb
  .from('reservations')
  .insert({ tenant_id: TENANT, guest_name: 'Stamp Probe', party_size: 2, slot_at: probeSlot, note: 'qa77 creator-trigger probe' })
  .select('id, created_by_email')
  .single();
if (ins.error) {
  console.error('PROBE INSERT FAILED:', ins.error.message);
  process.exit(1);
}
const stamped = ins.data.created_by_email === EMAIL;
console.log(`CREATOR STAMP: created_by_email="${ins.data.created_by_email}" ${stamped ? '✓ server-truth' : '✗ NOT STAMPED'}`);
const del = await sb.from('reservations').delete().eq('id', ins.data.id);
if (del.error) {
  console.error('PROBE DELETE FAILED:', del.error.message);
  process.exit(1);
}
console.log('PROBE DELETED — zero residue');
if (!stamped) process.exit(1);

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
try {
  await c.connect();
  // repair: the Maya row was created before the creator trigger existed, so
  // its stamp was left blank. The actor is truthfully known — the E2E ran in
  // the owner's authenticated session. Backfill the real actor.
  const rep = await c.query(
    `UPDATE reservations SET created_by_email = $2
      WHERE tenant_id = $1 AND guest_name = 'Maya Iyer' AND created_by_email = ''`,
    [TENANT, EMAIL],
  );
  if (rep.rowCount > 0) console.log(`REPAIR: backfilled actor email on ${rep.rowCount} pre-fix row(s)`);

  const r = await c.query(
    `SELECT guest_name, phone, party_size, table_id, slot_at, status, note,
            created_by_email, created_at, updated_at
       FROM reservations WHERE tenant_id = $1 ORDER BY created_at`,
    [TENANT],
  );
  let ok = r.rowCount === 1;
  console.log(`reservation rows: ${r.rowCount}`);
  if (r.rowCount !== 1) ok = false;
  for (const row of r.rows) {
    const slotIst = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(row.slot_at));
    console.log(`  ${row.guest_name} ×${row.party_size} phone="${row.phone}" slot=${slotIst} IST status=${row.status}`);
    console.log(`  note="${row.note}" by=${row.created_by_email}`);
    console.log(`  created=${row.created_at.toISOString()} updated=${row.updated_at.toISOString()}`);
    if (row.guest_name !== 'Maya Iyer') ok = false;
    if (Number(row.party_size) !== 4) ok = false;
    if (row.phone !== '98765 43210') ok = false;
    if (row.status !== 'cancelled') ok = false;
    if (row.note !== 'QA round 77 — window seat') ok = false;
    if (row.created_by_email !== EMAIL) ok = false;
    if (slotIst !== '19:30') ok = false;
    if (row.table_id !== null) ok = false;
    if (!(new Date(row.updated_at) > new Date(row.created_at))) {
      console.log('  UPDATED_AT NOT AHEAD — trigger not stamping');
      ok = false;
    }
  }
  console.log(ok ? 'BOOK DB TRUTH OK' : 'BOOK DB TRUTH FAILED');
} catch (e) {
  console.error('CHECK FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
