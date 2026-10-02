// Task 72 — storage policy verification (positive + negative) as the OWNER's
// own JWT, exactly the browser's path: same anon key, same auth, same API.
//   1. NEGATIVE upload — path OUTSIDE the operator's own folder must be refused by RLS.
//   2. NEGATIVE upload — non-image mime must be refused by the bucket mime guard.
//   3. POSITIVE delete — removing your own uploaded object must succeed (cleanup).
// Run: node scripts/qa72-storage-policy.mjs
import { createClient } from '@supabase/supabase-js';

const URL = 'https://gehjsxopcowmotgrrcgc.supabase.co';
// anon key — public client key (same one the app ships)
// same publishable anon key the app client ships (src/lib/supabase.ts)
const ANON = 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32';
const EMAIL = 'qrowner@qrflowcafe.in';
const PW = 'x^*rGYEzwF$xqH_6';
const sb = createClient(URL, ANON);

const auth = await sb.auth.signInWithPassword({ email: EMAIL, password: PW });
if (auth.error) {
  console.error('AUTH FAILED:', auth.error.message);
  process.exit(1);
}
const uid = auth.data.user.id;
console.log('AUTH OK: uid', uid);

// 1 — NEGATIVE: someone else's folder
// allowed mime on purpose — the refusal must come from the FOLDER policy, not the mime guard
const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
const bad = await sb.storage.from('tenant-logos').upload(`not-${uid}-folder/x.png`, png, { contentType: 'image/png' });
console.log('NEGATIVE cross-folder upload (png mime) →', bad.error ? `refused (${bad.error.message.slice(0, 60)})` : 'UNEXPECTEDLY SUCCEEDED');
if (!bad.error) process.exitCode = 1;

// 2 — NEGATIVE: wrong mime
const badMime = await sb.storage
  .from('tenant-logos')
  .upload(`${uid}/evil.txt`, new Blob(['hello'], { type: 'text/plain' }), { contentType: 'text/plain' });
console.log('NEGATIVE text-mime upload →', badMime.error ? `refused (${badMime.error.message.slice(0, 60)})` : 'UNEXPECTEDLY SUCCEEDED');
if (!badMime.error) process.exitCode = 1;

// 3 — POSITIVE: delete your own object (the one the browser uploaded)
const del = await sb.storage.from('tenant-logos').remove([`${uid}/logo-1790971010816.png`]);
if (del.error) {
  console.error('DELETE FAILED:', del.error.message);
  process.exitCode = 1;
} else {
  console.log('POSITIVE own-folder delete → removed', del.data?.map((d) => d.name).join(', '));
}
process.exit(process.exitCode || 0);
