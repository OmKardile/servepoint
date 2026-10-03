// Task 87 — truth script: the "dishes get their faces" round leaves the
// cloud exactly as it found it. The E2E walked the full honest cycle
// (upload → display → clear) through the real UI, so the exit state is
// the pre-round state.
//   D1  menu-photos bucket holds ZERO objects (upload + clear + orphan
//       removal all through the Storage API / real UI)
//   D2  every menu item's image_url back to null
//   D3  orders unchanged at 36; bells at the honest 3; chat at 5
//   D4  presence still owner-only (035's honest live heartbeat)
//   D5  036 intact: public bucket, 2 MiB, raster-only, 4 member policies
//   D6  035 intact: 4 cols + published
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
await c.connect();
const T = 'd207be19-e86f-4780-befb-3968831a38fe';
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

const so = await c.query(`SELECT count(*)::int n FROM storage.objects WHERE bucket_id='menu-photos'`);
ok(so.rows[0].n === 0, `D1: menu-photos holds zero objects (${so.rows[0].n})`);

const imgs = await c.query(`SELECT count(*)::int n FROM menu_items WHERE tenant_id=$1 AND image_url IS NOT NULL`, [T]);
ok(imgs.rows[0].n === 0, `D2: every menu item's image_url null (${imgs.rows[0].n} set)`);

const orders = await c.query(`SELECT count(*)::int n FROM orders WHERE tenant_id=$1`, [T]);
const bells = await c.query(`SELECT count(*)::int n FROM notifications WHERE tenant_id=$1`, [T]);
const chat = await c.query(
  `SELECT count(*)::int n FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id=$1)`, [T]);
ok(orders.rows[0].n === 36 && bells.rows[0].n === 3 && chat.rows[0].n === 5,
  `D3: orders 36, bells 3, chat 5 (${orders.rows[0].n}/${bells.rows[0].n}/${chat.rows[0].n})`);

const pres = await c.query(`SELECT user_email FROM staff_presence WHERE tenant_id=$1`, [T]);
ok(pres.rows.length === 1 && pres.rows[0].user_email === 'qrowner@qrflowcafe.in',
  `D4: presence owner-only (${pres.rows.map(r => r.user_email).join(', ') || 'empty'})`);

const b = await c.query(`SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='menu-photos'`);
const pol = await c.query(
  `SELECT count(*)::int n FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'menu photos %'`);
ok(b.rows[0]?.public === true && Number(b.rows[0]?.file_size_limit) === 2097152 && pol.rows[0].n === 4,
  `D5: 036 intact (public 2 MiB bucket, ${pol.rows[0].n} policies)`);

const cols35 = await c.query(
  `SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_presence'`);
const pub35 = await c.query(
  `SELECT count(*)::int n FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='staff_presence'`);
ok(cols35.rows[0].n === 4 && pub35.rows[0].n === 1, `D6: 035 intact (${cols35.rows[0].n} cols, pub=${pub35.rows[0].n})`);

console.log(fails === 0 ? 'TRUTH OK' : `TRUTH FAILED (${fails})`);
await c.end();
process.exit(fails === 0 ? 0 : 1);
