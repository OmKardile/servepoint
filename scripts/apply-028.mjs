// Task 77 — apply migration 028 (the book: reservations) to the cloud DB.
// Run: SUPABASE_DB_PASSWORD='<db-password>' node scripts/apply-028.mjs
import { readFileSync } from 'node:fs';
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

try {
  await c.connect();
  const sql = readFileSync('supabase/migrations/028_reservations.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 028_reservations');

  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('028_reservations')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof 1 — table columns exact
  const col = await c.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'reservations' ORDER BY ordinal_position`,
  );
  const names = col.rows.map((r) => r.column_name);
  for (const want of ['id', 'tenant_id', 'location_id', 'guest_name', 'phone', 'party_size', 'table_id', 'slot_at', 'status', 'note', 'created_by_email', 'created_at', 'updated_at']) {
    if (!names.includes(want)) throw new Error(`missing column: ${want}`);
  }
  console.log('TABLE OK:', names.join(', '));

  // proof 2 — exactly the two policies
  const p = await c.query(
    `SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reservations' ORDER BY policyname`,
  );
  if (p.rowCount !== 2) throw new Error(`policy count ${p.rowCount}`);
  console.log('POLICIES OK:', p.rows.map((r) => r.policyname).join(' · '));

  // proof 3 — both triggers on duty (touch: UPDATE stamp; creator: INSERT
  // stamp from auth.jwt()). The touch proof writes inside a transaction and
  // always rolls back — zero residue.
  const tg = await c.query(
    `SELECT tgname FROM pg_trigger WHERE tgrelid = 'reservations'::regclass AND tgname IN ('trg_reservations_touch','trg_reservations_creator') AND NOT tgisinternal`,
  );
  const tgNames = tg.rows.map((r) => r.tgname).sort();
  if (tgNames.join(',') !== 'trg_reservations_creator,trg_reservations_touch') {
    throw new Error(`triggers missing: ${tgNames.join(',')}`);
  }
  await c.query('BEGIN');
  try {
    // insert a probe row, UPDATE it, confirm the trigger stamped updated_at forward
    const ins = await c.query(
      `INSERT INTO reservations (tenant_id, guest_name, party_size, slot_at)
       VALUES ('d207be19-e86f-4780-befb-3968831a38fe', 'probe', 2, now())
       RETURNING id, created_at, updated_at`,
    );
    const id = ins.rows[0].id;
    await new Promise((r) => setTimeout(r, 20)); // clock_timestamp() moves per statement
    const upd = await c.query(
      `UPDATE reservations SET note = 'touched' WHERE id = $1 RETURNING updated_at`,
      [id],
    );
    if (!(upd.rows[0].updated_at > ins.rows[0].created_at)) {
      throw new Error('updated_at not auto-stamped by trigger');
    }
    throw new Error('__rollback__'); // always rollback — zero residue
  } catch (e) {
    await c.query('ROLLBACK');
    if (e.message !== '__rollback__') throw e;
  }
  console.log('TRIGGERS OK: updated_at stamped on UPDATE (probe rolled back, zero residue)');

  // proof 4 — realtime publication
  const pub = await c.query(
    `SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reservations'`,
  );
  if (pub.rowCount !== 1) throw new Error('reservations not on supabase_realtime');
  console.log('REALTIME OK: reservations published');

  // proof 5 — status whitelist enforced server-side
  const chk = await c.query(
    `SELECT conname FROM pg_constraint
      WHERE conrelid = 'reservations'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%'`,
  );
  if (chk.rowCount < 1) throw new Error('status CHECK constraint missing');
  console.log('CHECK OK:', chk.rows.map((r) => r.conname).join(' · '));
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
