import pg from 'pg';
import { dbPassword } from './db-creds.mjs';
const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com', port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc', password: dbPassword(),
  database: 'postgres', ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(
  `SELECT a.qty, a.reason, a.note, a.created_at FROM stock_adjustments a
    WHERE a.tenant_id='d207be19-e86f-4780-befb-3968831a38fe' ORDER BY a.created_at DESC LIMIT 4`);
for (const row of r.rows) console.log(`${row.qty} ${row.reason} — "${row.note}" — ${row.created_at}`);
await c.end();
