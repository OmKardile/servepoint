// One-shot daily-hardening fixer (v5.27.1): strip the hardcoded DB password
// from the tracked one-shot scripts and route them through db-creds.mjs.
// Smallest correct change per file: the password literal becomes dbPassword()
// and one import line is added — each script keeps its own structure.
// Idempotent: files already carrying `dbPassword()` are skipped.
// The secret itself is never embedded here — it rides the env var, so this
// script stays committable and re-runnable.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SECRET = process.env.SUPABASE_DB_PASSWORD || '';
const PWD_LINE = `  password: '${SECRET}',`;
const REPLACEMENT = '  password: dbPassword(),';
const IMPORT = "import { dbPassword } from './db-creds.mjs';";

// Tracked files only — scripts/apply-025.mjs is untracked, in-flight work of
// the parallel feature loop; its author owns that file this run.
const tracked = execSync("git ls-files scripts/", { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.endsWith('.mjs'));

let changed = 0;
for (const file of tracked) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(SECRET)) continue; // nothing to do (already clean or no db)
  if (src.includes('dbPassword(')) {
    console.log(`SKIP (already routed): ${file}`);
    continue;
  }
  let next = src.replace(PWD_LINE, REPLACEMENT);
  if (next === src) {
    // Fallback for any exotic shape: swap just the literal inside the line.
    next = src.replace(`'${SECRET}'`, 'dbPassword()');
  }
  if (next === src) {
    console.log(`UNRECOGNIZED SHAPE — left alone: ${file}`);
    continue;
  }
  // Insert the import after the last existing top-of-file import line, or at
  // the very top when the file has none.
  const lines = next.split('\n');
  let lastImport = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (/^import\b/.test(lines[i])) lastImport = i;
  }
  if (lastImport >= 0) lines.splice(lastImport + 1, 0, IMPORT);
  else lines.unshift(IMPORT);
  writeFileSync(file, lines.join('\n'));
  changed++;
  console.log(`STRIPPED: ${file}`);
}
console.log(`\n${changed} file(s) cleaned.`);
