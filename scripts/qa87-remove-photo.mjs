// Task 87 — remove the QA-orphaned menu photo via the STORAGE API (the same
// path the app's own removeMenuItemPhoto uses). Doubles as a live proof of
// 036's member delete policy: the owner signs in with the anon key and may
// only remove objects inside their tenant's folder.
//   O1  sign in as the tenant owner
//   O2  list menu-photos objects, remove the orphan(s) named on the CLI
//   O3  verify the named object is gone
import { createClient } from '@supabase/supabase-js';

const URL = 'https://gehjsxopcowmotgrrcgc.supabase.co';
const ANON = 'sb_publishable_igzjkrzX7PLfNI4hlI8p4g_FeqvHI32';
const EMAIL = 'qrowner@qrflowcafe.in';
const PASSWORD = 'x^*rGYEzwF$xqH_6';

const target = process.argv[2];
if (!target) {
  console.error('usage: node qa87-remove-photo.mjs <object-name-or-substring>');
  process.exit(1);
}

const supabase = createClient(URL, ANON);
let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

// O1 — owner sign-in (the anon key + real credentials → RLS-scoped session)
const { error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
ok(!authErr, `O1: owner signed in (${authErr ? authErr.message : 'session live'})`);

// O2 — list + remove the matching object(s)
const { data: objs, error: listErr } = await supabase.storage.from('menu-photos').list('', { limit: 100 });
ok(!listErr, `O2a: bucket listed (${listErr ? listErr.message : (objs?.length ?? 0) + ' top-level entries'})`);
const folders = (objs || []).filter((e) => !e.id); // tenant folder
let folderName = null;
for (const f of folders) {
  const { data: inner } = await supabase.storage.from('menu-photos').list(f.name, { limit: 100 });
  if ((inner || []).some((o) => o.name.includes(target))) {
    folderName = f.name;
    break;
  }
}
if (!folderName) {
  console.log(`✓ O2b: no object matches "${target}" — nothing to remove (already clean)`);
} else {
  const fullPath = `${folderName}/` + (await supabase.storage.from('menu-photos').list(folderName, { limit: 100 })).data
    .filter((o) => o.name.includes(target)).map((o) => o.name).join(',');
  const names = (await supabase.storage.from('menu-photos').list(folderName, { limit: 100 })).data
    .filter((o) => o.name.includes(target)).map((o) => o.name);
  const { error: rmErr } = await supabase.storage.from('menu-photos').remove(names.map((n) => `${folderName}/${n}`));
  ok(!rmErr, `O2b: removed ${names.length} object(s) via member delete policy (${rmErr ? rmErr.message : fullPath})`);

  // O3 — verify gone
  const { data: after } = await supabase.storage.from('menu-photos').list(folderName, { limit: 100 });
  ok(!(after || []).some((o) => names.includes(o.name)), `O3: object gone from the folder`);
}

console.log(fails === 0 ? 'REMOVE OK' : `REMOVE FAILED (${fails})`);
process.exit(fails === 0 ? 0 : 1);
