/**
 * Maps raw Postgres/PostgREST error messages to precise, actionable hints
 * for the honest error cards (Messages / Notifications / Settings → Team).
 *
 * The screens keep `error.message` only, so matching runs on message text.
 * Both patterns below are stable Postgres/PostgREST strings:
 *  - 42P17 → "infinite recursion detected in policy for relation …"
 *  - missing table → "Could not find the table 'x' in the schema cache"
 *    (PostgREST) or 'relation "x" does not exist' (42P01).
 */
export function dbErrorHint(message: string | null | undefined): string {
  const msg = (message || '').toLowerCase();

  if (msg.includes('infinite recursion')) {
    return (
      'This is a Postgres row-level-security recursion guard (42P17), not missing data. ' +
      'Fix: Supabase Dashboard → SQL Editor → paste & run supabase/migrations/006_fix_rls_recursion.sql ' +
      '(idempotent, touches no data), then Retry here.'
    );
  }

  if (msg.includes('schema cache') || msg.includes('does not exist')) {
    return (
      'A required table is missing — run migrations 004 → 006 from supabase/migrations/ ' +
      'in Supabase → SQL Editor (in order), then Retry.'
    );
  }

  return 'If this says the table does not exist, migration 004 (notifications & messages) has not been applied to Supabase yet.';
}
