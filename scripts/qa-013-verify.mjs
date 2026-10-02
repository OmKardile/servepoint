// QA verify: 013 applied live? counter-gate engine + table release trigger
import { Client } from 'pg';
import { dbPassword } from './db-creds.mjs';

const client = new Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: dbPassword(),
  database: 'postgres',
});

await client.connect();

// 1. 013 live? (new→pending in advance fn + auto-advance in payment fn)
const fns = await client.query(`
  SELECT
    (pg_get_functiondef('sp_advance_order(UUID,TEXT)'::regprocedure) LIKE '%v_status = ''new'' AND p_to_status IN (''pending''%') AS advance_v2,
    (pg_get_functiondef('sp_record_payment(UUID,TEXT,NUMERIC)'::regprocedure) LIKE '%IF v_status IN (''new'', ''pending'')%') AS pay_autoadvance;
`);
console.log('013 engine:', fns.rows[0]);

// 2. publication + trigger still intact (011)
const pub = await client.query(`SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('dining_tables','table_sessions')`);
const trg = await client.query(`SELECT count(*) FROM pg_trigger WHERE tgname='trg_orders_sync_table' AND NOT tgisinternal`);
console.log('011 pub/trigger:', pub.rows[0].count, trg.rows[0].count);

// 3. cloud census + leftovers
const census = await client.query(`
  SELECT (SELECT count(*) FROM tenants) tenants,
         (SELECT count(*) FROM orders) orders,
         (SELECT count(*) FROM payments) payments,
         (SELECT count(*) FROM dining_tables) tables,
         (SELECT count(*) FROM menu_variants) variants,
         (SELECT count(*) FROM addons) addons,
         (SELECT count(*) FROM table_sessions) sessions;
`);
console.log('census:', census.rows[0]);

// 4. any order stuck in new/pending (inbox backlog check)
const backlog = await client.query(`SELECT id, status, grand_total FROM orders WHERE status IN ('new','pending') ORDER BY created_at`);
console.log('inbox backlog:', backlog.rows);

// 5. tables with dangling active_order_id (release-trigger integrity)
const dangling = await client.query(`
  SELECT t.id, t.name, t.status, t.active_order_id, o.status AS order_status
  FROM dining_tables t LEFT JOIN orders o ON o.id = t.active_order_id
  WHERE t.active_order_id IS NOT NULL AND (o.id IS NULL OR o.status IN ('completed','cancelled'));
`);
console.log('dangling table holds:', dangling.rows);

await client.end();
console.log('QA-VERIFY-DONE');
