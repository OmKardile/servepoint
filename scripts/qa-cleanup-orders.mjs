import pg from 'pg';

const client = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.gehjsxopcowmotgrrcgc',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const q = async (label, sql) => {
  try {
    const res = await client.query(sql);
    console.log(label, JSON.stringify(res.rows || res.rowCount));
  } catch (e) {
    console.error(label, 'FAILED:', e.message);
    process.exitCode = 1;
  }
};

await client.connect();
await q('TENANT:', `SELECT id FROM public.tenants WHERE slug='qrflowcafe'`);
await q(
  'DELETE ORDERS >=10:',
  `DELETE FROM public.orders
    WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug='qrflowcafe')
      AND order_number >= 10`
);
await q('RESIDUAL PAYMENTS:', `SELECT count(*)::text AS n FROM public.payments`);
await q('RESIDUAL TRAIL:', `SELECT count(*)::text AS n FROM public.order_status_history`);
await q(
  'TABLES:',
  `SELECT table_number, status, (active_order_id IS NULL) AS free FROM public.dining_tables WHERE tenant_id=(SELECT id FROM public.tenants WHERE slug='qrflowcafe')`
);
await q('ORDER COUNT:', `SELECT count(*)::text AS n FROM public.orders`);
await client.end();
