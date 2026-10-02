// Task 68 probe — IST-day spread of the orders ledger (prior-week availability
// for the floor-rhythm "vs prior week" compare). Read-only.
import pg from 'pg';
import { dbConfig } from './db-creds.mjs';

const client = new pg.Client(dbConfig());
await client.connect();

const spread = await client.query(`
  SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d,
         count(*) AS n
  FROM orders
  WHERE status <> 'cancelled'
    AND tenant_id = 'd207be19-e86f-4780-befb-3968831a38fe'
  GROUP BY 1 ORDER BY 1`);
console.log('== QR Flow Cafe non-cancelled orders by IST day ==');
for (const r of spread.rows) console.log(`${r.d}  ${r.n}`);

const prior = await client.query(`
  SELECT count(*) AS n FROM orders
  WHERE status <> 'cancelled'
    AND tenant_id = 'd207be19-e86f-4780-befb-3968831a38fe'
    AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '13 day') AT TIME ZONE 'Asia/Kolkata'
    AND created_at <  (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '6 day')  AT TIME ZONE 'Asia/Kolkata'`);
console.log(`QR Flow Cafe prior-7d window (d-13..d-7) rows: ${prior.rows[0].n}`);

const tableBound = await client.query(`
  SELECT count(*) AS n FROM orders
  WHERE status <> 'cancelled' AND table_id IS NOT NULL
    AND tenant_id = 'd207be19-e86f-4780-befb-3968831a38fe'
    AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '6 day') AT TIME ZONE 'Asia/Kolkata'`);
console.log(`QR Flow Cafe table-bound in last 7d: ${tableBound.rows[0].n}`);

const priorBound = await client.query(`
  SELECT count(*) AS n FROM orders
  WHERE status <> 'cancelled' AND table_id IS NOT NULL
    AND tenant_id = 'd207be19-e86f-4780-befb-3968831a38fe'
    AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '13 day') AT TIME ZONE 'Asia/Kolkata'
    AND created_at <  (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') - interval '6 day')  AT TIME ZONE 'Asia/Kolkata'`);
console.log(`QR Flow Cafe table-bound prior 7d: ${priorBound.rows[0].n}`);

await client.end();
