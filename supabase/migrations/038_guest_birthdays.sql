-- ============================================================================
-- 038_guest_birthdays.sql — the CRM remembers the day
--
-- The Guests screen has whispered "birthday in March…" into a free-text
-- notes field since 016 shipped — data the CRM could not read back. This
-- migration gives the whisper a column: birthday_md, a month-day string
-- ('MM-DD'), deliberately WITHOUT a year — a café usually knows the day,
-- not the birth year, and a fake year would be a lie the CRM can't undo.
--
-- Shape: TEXT + CHECK (not DATE) so '02-29' is a legal birthday without
-- pinning a placeholder leap year. The UI builds the day dropdown from the
-- month (Feb caps at 29) and stores the normalized 'MM-DD'.
--
-- Readers: the guest row wears a "today" chip on its birthday; the
-- Dashboard's NeedsNow mirror gains a "Celebration today" slot so the
-- landing screen opens with the day's warm fact before any ticket waits.
--
-- Deliberately untouched: the 016 auto-enrich trigger (it upserts identity
-- from orders and must not stamp birthdays it never asked for), RLS
-- (column inherits the table's tenant policy), and the supabase_realtime
-- publication (table-level — the new column rides the existing channel).
-- ============================================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS birthday_md TEXT;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_birthday_md_check;
ALTER TABLE customers ADD CONSTRAINT customers_birthday_md_check
  CHECK (birthday_md IS NULL OR birthday_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
