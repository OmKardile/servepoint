// Task 78 — apply migration 029 (KDS item check-off) to the cloud DB.
// Run: SUPABASE_DB_PASSWORD='<db-password>' node scripts/apply-029.mjs
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
  const sql = readFileSync('supabase/migrations/029_order_item_checks.sql', 'utf8');
  await c.query(sql);
  console.log('APPLIED 029_order_item_checks');

  await c.query(
    `INSERT INTO schema_migrations (name) VALUES ('029_order_item_checks')
     ON CONFLICT (name) DO NOTHING`,
  ).catch(async (e) => {
    const t = await c.query(`SELECT to_regclass('public.schema_migrations') AS t`);
    if (t.rows[0].t) throw e;
    console.log('SENTINEL SKIPPED (no schema_migrations table)');
  });
  console.log('SENTINEL OK');

  // proof 1 — column exists, right type
  const col = await c.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'checked_at'`,
  );
  if (col.rowCount !== 1 || col.rows[0].data_type !== 'timestamp with time zone') {
    throw new Error('checked_at column missing or wrong type');
  }
  console.log('COLUMN OK: order_items.checked_at TIMESTAMPTZ');

  // proof 2 — the guard fires: checking a line on a TERMINAL ticket is
  // refused with ORDER_NOT_ACTIVE. The probe picks a real completed/cancelled
  // ticket's item, tries the tick inside a transaction, ALWAYS rolls back.
  await c.query('BEGIN');
  try {
    const probe = await c.query(
      `SELECT oi.id FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
       WHERE lower(o.status) IN ('cancelled','completed')
       ORDER BY oi.created_at DESC LIMIT 1`,
    );
    if (probe.rowCount !== 1) throw new Error('no terminal ticket item found for the probe');
    try {
      await c.query(`UPDATE order_items SET checked_at = now() WHERE id = $1`, [probe.rows[0].id]);
      throw new Error('guard not enforced — terminal tick went through');
    } catch (e) {
      if (!String(e.message).includes('ORDER_NOT_ACTIVE')) throw e;
    }
    throw new Error('__rollback__'); // always rollback — zero residue
  } catch (e) {
    await c.query('ROLLBACK');
    if (e.message !== '__rollback__') throw e;
  }
  console.log('GUARD OK: tick on a terminal ticket refused (ORDER_NOT_ACTIVE, probe rolled back)');

  // proof 3 — the live path still works: checking + unchecking a line on an
  // ACTIVE ticket inside the same rolled-back transaction.
  await c.query('BEGIN');
  try {
    const probe = await c.query(
      `SELECT oi.id FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
       WHERE lower(o.status) IN ('pending','preparing','ready')
       ORDER BY oi.created_at DESC LIMIT 1`,
    );
    if (probe.rowCount !== 1) throw new Error('no active ticket item found for the probe');
    const id = probe.rows[0].id;
    const tick = await c.query(`UPDATE order_items SET checked_at = now() WHERE id = $1 RETURNING checked_at`, [id]);
    if (!tick.rows[0].checked_at) throw new Error('tick on live ticket failed');
    const untick = await c.query(`UPDATE order_items SET checked_at = NULL WHERE id = $1 RETURNING checked_at`, [id]);
    if (untick.rows[0].checked_at !== null) throw new Error('un-tick on live ticket failed');
    throw new Error('__rollback__'); // always rollback — zero residue
  } catch (e) {
    await c.query('ROLLBACK');
    if (e.message !== '__rollback__') throw e;
  }
  console.log('LIVE OK: tick + un-tick on a live ticket both pass (probe rolled back, zero residue)');
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
