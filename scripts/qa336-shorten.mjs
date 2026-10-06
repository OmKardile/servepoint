// qa336-shorten: drag the LIVE table session's expires_at to NOW + SECONDS.
// Args: <session_token_prefix> <seconds> — finds the row by token prefix.
// Usage: node scripts/qa336-shorten.mjs NmExODdlNTMtOTAxZi00 70
import { createClient } from '@supabase/supabase-js';

const PREFIX = process.argv[2];
const SECONDS = Number(process.argv[3] ?? 70);
if (!PREFIX) { console.error('need session token prefix'); process.exit(1); }

const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32');
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const { data: rows, error: eSel } = await db
  .from('table_sessions')
  .select('id, session_token, expires_at')
  .like('session_token', `${PREFIX}%`)
  .order('created_at', { ascending: false })
  .limit(3);
if (eSel) { console.error('SELECT refused:', eSel.message); process.exit(3); }
const row = (rows ?? [])[0];
if (!row) { console.error('no session found for prefix', PREFIX); process.exit(4); }

const expires = new Date(Date.now() + SECONDS * 1000).toISOString();
const { error: eUpd } = await db.from('table_sessions').update({ expires_at: expires }).eq('id', row.id);
if (eUpd) { console.error('UPDATE refused:', eUpd.message); process.exit(5); }
console.log('SHORTENED session', row.id, '→ expires', expires, `(+${SECONDS}s)`);
