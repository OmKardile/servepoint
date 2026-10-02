import pg from 'pg';
import { dbPassword } from '/home/z/my-project/scripts/db-creds.mjs';
const c = new pg.Client({host:'aws-0-ap-northeast-2.pooler.supabase.com',port:5432,user:'postgres.gehjsxopcowmotgrrcgc',password:dbPassword(),database:'postgres',ssl:{rejectUnauthorized:false}});
await c.connect();
for (let i = 0; i < 12; i++) {
  await c.query(`UPDATE conversation_typing SET typing_at = now() WHERE user_email='probe-foh@qa.dev'`);
  await new Promise(r => setTimeout(r, 2000));
}
await c.end();
console.log('heartbeat done');
