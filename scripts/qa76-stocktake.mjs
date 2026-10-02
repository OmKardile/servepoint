// Task 76 — stocktake verification: DB truth of the batch correction.
// Expect: exactly 2 NEW correction rows (Butter +50, Coffee beans −20) with
// the batch note, stamped by the owner. Read-only. Run with SUPABASE_DB_PASSWORD.
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
  const adj = await c.query(
    `SELECT ii.name, sa.qty, sa.reason, sa.note, sa.created_by_email
       FROM stock_adjustments sa JOIN inventory_items ii ON ii.id = sa.inventory_item_id
      WHERE sa.tenant_id = $1 AND sa.reason = 'correction' ORDER BY sa.created_at DESC`,
    [T],
  );
  console.log(`correction rows: ${adj.rowCount}`);
  let ok = adj.rowCount === 2;
  for (const r of adj.rows) {
    console.log(`  ${r.name}: ${r.qty} note="${r.note}" by=${r.created_by_email}`);
    if (r.note !== 'QA round 76 — tap count') ok = false;
  }
  const want = { Butter: 5050, 'Coffee beans': 4880 };
  for (const [name, level] of Object.entries(want)) {
    const s = await c.query(
      `SELECT current_stock FROM inventory_items WHERE tenant_id = $1 AND name = $2`,
      [T, name],
    );
    const got = Number(s.rows[0].current_stock);
    console.log(`${name}: books ${got} ${got === level ? '✓' : `≠ ${level} MISMATCH`}`);
    if (got !== level) ok = false;
  }
  console.log(ok ? 'STOCKTAKE DB TRUTH OK' : 'STOCKTAKE DB TRUTH FAILED');
  if (!ok) process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
