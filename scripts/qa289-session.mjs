// qa289-session: steer the live session's window for the 5.250.0 E2E —
// "past-due soon" (95s) lets the server anchor run the countdown past zero;
// "future" (10 min) feeds the next 30s tick a live anchor so the re-arm is
// proven from the SERVER's word, not the phone's. The session row rides the
// RLS token clause: pass the live session token as argv[3] (x-table-session-token).
import { createClient } from '@supabase/supabase-js';
const sessionToken = process.argv[3] || '';
const db = createClient('https://gehjsxopcowmotgrrcgc.supabase.co', 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32', {
  global: { headers: { 'x-table-session-token': sessionToken } },
});
const { error: eAuth } = await db.auth.signInWithPassword({ email: 'admin@tsos.dev', password: 'admin123456' });
if (eAuth) { console.error('AUTH refused:', eAuth.message); process.exit(2); }

const mode = process.argv[2] || 'peek';
const { data: sessions, error } = await db
  .from('table_sessions')
  .select('id, table_id, session_token, expires_at, status')
  .order('created_at', { ascending: false })
  .limit(6);
if (error) { console.error('SESSIONS refused:', error.message); process.exit(3); }
const rows = sessions ?? [];
if (rows.length === 0) { console.log('no session rows visible'); process.exit(0); }
const pick = rows.find((s) => s.session_token === sessionToken) ?? rows[0];
console.log('PICK:', pick.id, pick.status, 'expires_at:', pick.expires_at);

if (mode === 'peek') process.exit(0);

const seconds = mode === 'past' ? 95 : 600;
const target = new Date(Date.now() + seconds * 1000).toISOString();
const { error: upErr, data: upData } = await db
  .from('table_sessions')
  .update({ expires_at: target })
  .eq('id', pick.id)
  .select('id');
if (upErr) { console.error('UPDATE refused:', upErr.message); process.exit(4); }
console.log(`SET expires_at = ${target} (${seconds}s) — rows touched: ${(upData ?? []).length}`);
