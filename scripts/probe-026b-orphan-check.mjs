// Task 68 — verify no orphan order_items survived the rhythm-fixture cleanup.
import pg from 'pg';
import { dbConfig } from './db-creds.mjs';

const client = new pg.Client(dbConfig());
await client.connect();
const orphans = await client.query(
  `SELECT count(*)::int AS n FROM order_items oi
   WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = oi.order_id)`,
);
console.log(`orphan order_items: ${orphans.rows[0].n}`);
const tags = await client.query(
  `SELECT count(*)::int AS n FROM orders WHERE notes = 'rhy-fixture'`,
);
console.log(`remaining rhy-fixture orders: ${tags.rows[0].n}`);
await client.end();
