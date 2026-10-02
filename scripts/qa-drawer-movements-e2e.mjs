// Task 52 — DB E2E for migration 021 (cash drawer movements).
// Run: node scripts/qa-drawer-movements-e2e.mjs
// The core assertion: sp_close_drawer expected = float + cash-in − movements.
// Owner loop via forged claims (Task 51 pattern), self-cleaning.
import pg from 'pg';

const REF = 'gehjsxopcowmotgrrcgc';
const OWNER_EMAIL = 'qrowner@qrflowcafe.in';
const TENANT = 'd207be19-e86f-4780-befb-3968831a38fe';

const c = new pg.Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  user: `postgres.${REF}`,
  password: 'gen.narumii@protonmail.comA1',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
};
let OWNER_UID = '';
const createdSessionIds = [];
const asOwner = async () => {
  await c.query(`SET ROLE authenticated`);
  await c.query(`SELECT set_config('request.jwt.claims', $1, false)`,
    [JSON.stringify({ sub: OWNER_UID, role: 'authenticated', email: OWNER_EMAIL })]);
};
const asAnon = async () => {
  await c.query(`RESET request.jwt.claims`);
  await c.query(`SET ROLE anon`);
};
const asAdmin = async () => {
  await c.query(`RESET ROLE`);
  await c.query(`RESET request.jwt.claims`);
};

try {
  await c.connect();

  /* ── 1. structure ── */
  console.log('STRUCTURE');
  const tbl = await c.query(`SELECT relrowsecurity::int AS rls FROM pg_class WHERE oid='public.cash_drawer_movements'::regclass`);
  ok('table exists + RLS enabled', tbl.rows[0]?.rls === 1);
  const pol = await c.query(`SELECT count(*) AS n FROM pg_policies WHERE tablename='cash_drawer_movements'`);
  ok('exactly 1 policy', pol.rows[0].n === '1');
  const anon = await c.query(`SELECT has_function_privilege('anon','sp_record_drawer_movement(uuid,text,numeric,text)','EXECUTE') AS a`);
  ok('anon has NO execute', anon.rows[0].a === false);
  const pub = await c.query(`SELECT count(*) AS n FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='cash_drawer_movements'`);
  ok('on realtime publication', pub.rows[0].n === '1');
  const nets = await c.query(`SELECT position('cash_drawer_movements' in prosrc) > 0 AS n FROM pg_proc WHERE proname='sp_close_drawer' AND pronamespace='public'::regnamespace`);
  ok('sp_close_drawer nets the movements ledger', nets.rows[0].n === true);
  const over = await c.query(`SELECT count(*) AS n FROM pg_proc WHERE proname IN ('sp_record_drawer_movement','sp_close_drawer','sp_open_drawer') AND pronamespace='public'::regnamespace`);
  ok('exactly 3 drawer RPCs (one each)', over.rows[0].n === '3');
  const owner = await c.query(`SELECT id FROM auth.users WHERE email = $1`, [OWNER_EMAIL]);
  OWNER_UID = owner.rows[0]?.id || '';
  ok('owner auth uid found', OWNER_UID !== '');

  /* ── 2. RPC loop as owner ── */
  console.log('RPC AS OWNER');
  await asOwner();

  const s1 = (await c.query(`SELECT sp_open_drawer(500.00) AS s`)).rows[0].s;
  createdSessionIds.push(s1.id);
  ok('shift opened with float 500', Number(s1.opening_float) === 500);

  const badKind = await c.query(`SELECT sp_record_drawer_movement($1,'steal',50,'x')`, [s1.id]).then(() => null, (e) => e);
  ok("kind 'steal' → BAD_KIND", badKind?.message.includes('BAD_KIND'));
  const badAmt = await c.query(`SELECT sp_record_drawer_movement($1,'drop',-5,'x')`, [s1.id]).then(() => null, (e) => e);
  ok('amount −5 → BAD_AMOUNT', badAmt?.message.includes('BAD_AMOUNT'));
  const zeroAmt = await c.query(`SELECT sp_record_drawer_movement($1,'drop',0,'x')`, [s1.id]).then(() => null, (e) => e);
  ok('amount 0 → BAD_AMOUNT', zeroAmt?.message.includes('BAD_AMOUNT'));
  const noReason = await c.query(`SELECT sp_record_drawer_movement($1,'drop',50,'   ')`, [s1.id]).then(() => null, (e) => e);
  ok('blank reason → REASON_REQUIRED', noReason?.message.includes('REASON_REQUIRED'));
  const longReason = await c.query(`SELECT sp_record_drawer_movement($1,'drop',50,'${'x'.repeat(281)}')`, [s1.id]).then(() => null, (e) => e);
  ok('281-char reason → TOO_LONG', longReason?.message.includes('TOO_LONG'));
  const ghost = await c.query(`SELECT sp_record_drawer_movement(gen_random_uuid(),'drop',50,'x')`).then(() => null, (e) => e);
  ok('unknown session → NOT_FOUND', ghost?.message.includes('NOT_FOUND'));

  const m1 = await c.query(`SELECT sp_record_drawer_movement($1,'payout',200.00,'  supplier paid at the door  ') AS m`, [s1.id]);
  const mv1 = m1.rows[0].m;
  ok('payout recorded', mv1?.kind === 'payout' && Number(mv1.amount) === 200,
     `reason trimmed: "${mv1?.reason}"`);
  const m2 = await c.query(`SELECT sp_record_drawer_movement($1,'drop',100.00,'lunch rush safe drop') AS m`, [s1.id]);
  const mv2 = m2.rows[0].m;
  ok('drop recorded', mv2?.kind === 'drop' && Number(mv2.amount) === 100);

  const closed = (await c.query(`SELECT sp_close_drawer($1, 200.00, 'exact after outflows') AS s`, [s1.id])).rows[0].s;
  ok('close nets outflows: expected = 500 + 0 cash − 300 = 200',
     Number(closed.expected_cash) === 200 && Number(closed.movements_out) === 300 && Number(closed.cash_in) === 0,
     `expected ${closed.expected_cash}, out ${closed.movements_out}`);
  ok('counted 200 → variance 0 (the payout is NOT the operator\'s fault)',
     Number(closed.variance) === 0, `variance ${closed.variance}`);

  const afterSeal = await c.query(`SELECT sp_record_drawer_movement($1,'drop',10,'too late')`, [s1.id]).then(() => null, (e) => e);
  ok('movement on sealed shift → DRAWER_NOT_OPEN', afterSeal?.message.includes('DRAWER_NOT_OPEN'));

  // no-movement path stays identical to 020
  const s2 = (await c.query(`SELECT sp_open_drawer(300.00) AS s`)).rows[0].s;
  createdSessionIds.push(s2.id);
  const c2 = (await c.query(`SELECT sp_close_drawer($1, 300.00, null) AS s`, [s2.id])).rows[0].s;
  ok('020 math unchanged with zero movements', Number(c2.expected_cash) === 300 && Number(c2.variance) === 0);

  await asAdmin();

  /* ── 3. lockout ── */
  console.log('LOCKOUT (anon)');
  await asAnon();
  const vis = await c.query(`SELECT count(*) AS n FROM cash_drawer_movements`);
  ok('anon SELECT sees 0 rows', vis.rows[0].n === '0');
  const ins = await c.query(`INSERT INTO cash_drawer_movements (tenant_id, session_id, kind, amount, reason) VALUES ($1, gen_random_uuid(), 'drop', 5, 'x')`, [TENANT]).then(() => null, (e) => e);
  ok('anon INSERT denied by RLS', ins !== null);
  await asAdmin();

  /* ── 4. cleanup — CASCADE takes the movements with the sessions ── */
  console.log('CLEANUP');
  await c.query(`DELETE FROM cash_drawer_sessions WHERE id = ANY($1)`, [createdSessionIds]);
  const leftS = await c.query(`SELECT count(*) AS n FROM cash_drawer_sessions`);
  const leftM = await c.query(`SELECT count(*) AS n FROM cash_drawer_movements`);
  ok('sessions back to 0', leftS.rows[0].n === '0');
  ok('movements cascade-deleted to 0', leftM.rows[0].n === '0');

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (e) {
  console.error('E2E ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
