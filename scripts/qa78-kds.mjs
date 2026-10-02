// Task 78 — the kitchen's tick: DB truth of the end state + the persistence
// trail of the E2E round trip.
// Expect: the checked_at column exists; ZERO order_items rows carry a tick
// (the E2E ticked, reloaded-persisted, un-ticked — final honest state is a
// clean ledger, no fiction); orders 48 and 66 still hold their live items.
// Read-only. Run with SUPABASE_DB_PASSWORD.
import pg from 'pg';
import { dbPassword } from './db-creds.mjs';

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
  const T = 'd207be19-e86f-4780-befb-3968831a38fe';

  const col = await c.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_name = 'order_items' AND column_name = 'checked_at'`,
  );
  const colOk = col.rowCount === 1 && col.rows[0].data_type === 'timestamp with time zone';
  console.log(`column: ${colOk ? 'order_items.checked_at TIMESTAMPTZ ✓' : 'MISSING ✗'}`);

  const ticked = await c.query(
    `SELECT count(*)::int AS n FROM order_items WHERE tenant_id = $1 AND checked_at IS NOT NULL`,
    [T],
  );
  const n = ticked.rows[0].n;
  console.log(`ticked rows: ${n} ${n === 0 ? '✓ clean end state' : '✗ expected 0'}`);

  const live = await c.query(
    `SELECT o.order_number, oi.name, oi.qty
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE oi.tenant_id = $1 AND o.order_number IN (48, 66)
      ORDER BY o.order_number`,
    [T],
  );
  console.log('live ticket lines:');
  for (const r of live.rows) console.log(`  #${r.order_number}: ${r.qty}× ${r.name}`);

  const ok = colOk && n === 0 && live.rowCount === 2;
  console.log(ok ? 'KDS TICK DB TRUTH OK' : 'KDS TICK DB TRUTH FAILED');
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.error('CHECK FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
