// Task 108 — apply 038 (the CRM remembers the day) and PROVE it:
//   P1  customers carries birthday_md (TEXT, nullable)
//   P2  the CHECK holds the shape: accepts '02-29', rejects '02-31' + '13-01'
//   P3  a STAGED fixture guest round-trips the value through the live table
//       (insert → read → update → read → delete; net zero rows)
//   P4  realtime publication still includes customers; RLS still on
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { dbPassword } from './db-creds.mjs';

const T = 'd207be19-e86f-4780-befb-3968831a38fe';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: dbPassword(),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

// Apply the migration (idempotent: ADD COLUMN IF NOT EXISTS + guarded constraint).
const sql = readFileSync(new URL('../supabase/migrations/038_guest_birthdays.sql', import.meta.url), 'utf8');
await c.query(sql);
console.log('applied 038 (column + CHECK)');

// P1 — the column exists, is TEXT, and is nullable.
const col = await c.query(
  `SELECT data_type, is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND table_name='customers' AND column_name='birthday_md'`);
ok(col.rows.length === 1 && col.rows[0].data_type === 'text' && col.rows[0].is_nullable === 'YES',
  `P1: customers.birthday_md is nullable text (${col.rows[0]?.data_type ?? 'missing'})`);

// P2 — the CHECK speaks: '02-29' legal, '02-31' and '13-01' refused.
const probe = await c.query(
  `INSERT INTO customers (tenant_id, name, phone, birthday_md)
   VALUES ($1, '__qa108_probe__', '+0000000000', '02-29') RETURNING id`, [T]);
const probeId = probe.rows[0].id;
let rejected = 0;
for (const bad of ['02-31', '13-01']) {
  try {
    await c.query(`UPDATE customers SET birthday_md=$2 WHERE id=$1`, [probeId, bad]);
  } catch { rejected++; }
}
ok(rejected === 2, `P2: CHECK rejects '02-31' and '13-01' (${rejected}/2 refused)`);
const round = await c.query(`SELECT birthday_md FROM customers WHERE id=$1`, [probeId]);
ok(round.rows[0].birthday_md === '02-29', `P2b: '02-29' round-trips (${round.rows[0].birthday_md})`);

// P3 — update path also works (the edit dialog's shape), then full cleanup.
await c.query(`UPDATE customers SET birthday_md='10-03' WHERE id=$1`, [probeId]);
const upd = await c.query(`SELECT birthday_md FROM customers WHERE id=$1`, [probeId]);
ok(upd.rows[0].birthday_md === '10-03', `P3: update path stores '10-03' (${upd.rows[0].birthday_md})`);
await c.query(`DELETE FROM customers WHERE id=$1`, [probeId]);
const gone = await c.query(`SELECT count(*)::int n FROM customers WHERE phone='+0000000000'`, );
ok(gone.rows[0].n === 0, 'P3b: probe guest deleted — net zero rows');

// P4 — no drift in the publication or the guards.
const pub = await c.query(
  `SELECT count(*)::int n FROM pg_publication_tables
   WHERE pubname='supabase_realtime' AND tablename='customers'`);
ok(pub.rows[0].n === 1, 'P4a: customers still rides supabase_realtime');
const rls = await c.query(
  `SELECT relrowsecurity FROM pg_class WHERE relname='customers'`);
ok(rls.rows[0].relrowsecurity === true, 'P4b: RLS still enforced on customers');

console.log(fails === 0 ? 'APPLY 038 OK' : `APPLY 038 FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
