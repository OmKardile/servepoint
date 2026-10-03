import re

p = '/home/z/my-project/src/components/eod/EodScreen.tsx'
s = open(p).read()

# 1. Replace the whole helper block from the ruler through istDayBounds fn.
pat = re.compile(
    r"/\* ─+ IST day-window helpers ─+ \*/\n\n"
    r"const IST_TZ = 'Asia/Kolkata';\n\n"
    r"/\*\* YYYY-MM-DD of \"now\" in IST \(en-CA gives calendar order\). \*/\n"
    r"function istTodayIso\(\): string \{\n"
    r"  return new Intl\.DateTimeFormat\('en-CA', \{\n"
    r"    timeZone: IST_TZ,\n"
    r"    year: 'numeric',\n"
    r"    month: '2-digit',\n"
    r"    day: '2-digit',\n"
    r"  \}\)\.format\(new Date\(\)\);\n\}\n\n"
    r"/\*\* \[00:00, next 00:00\) ISO window for an IST calendar day\. \*/\n"
    r"function istDayBounds\(dateIso: string\): \{ startIso: string; endIso: string \} \{\n"
    r"  const start = new Date\(`\$\{dateIso\}T00:00:00\+05:30`\);\n"
    r"  const end = new Date\(start\.getTime\(\) \+ 24 \* 60 \* 60 \* 1000\);\n"
    r"  return \{ startIso: start\.toISOString\(\), endIso: end\.toISOString\(\) \};\n\}\n",
)
repl = (
    "/* ────────────────────────── IST day-window helpers ───────────────────\n"
    "   5.97.0 — the Settings word (\"Timestamps in reports and shifts\") is\n"
    "   kept: the math lives in src/lib/appday.ts and follows prefs.timezone.\n"
    "   The historic IST names stay for the ledger's readability; on every\n"
    "   Indian device these helpers are exactly IST, unchanged to the paisa. */\n\n"
    "/** YYYY-MM-DD of \"now\" in the reporting timezone (en-CA calendar order). */\n"
    "function istTodayIso(): string {\n"
    "  return appTodayIso();\n}\n\n"
    "/** [00:00, next 00:00) window for a reporting-calendar day. */\n"
    "function istDayBounds(dateIso: string): { startIso: string; endIso: string } {\n"
    "  return appDayBoundsIso(dateIso);\n}\n"
)
s, n1 = pat.subn(repl, s)
assert n1 == 1, f'helper block subn={n1}'

# 2. shiftDay: noon anchor Z (tz-agnostic string shift) + comment touch-up.
old_shift = """function shiftDay(dateIso: string, days: number): string {
  /* v5.83.0 — IST-day arithmetic, fixed. The old anchor (midnight IST =
     18:30Z on the PREVIOUS UTC date) shifted the UTC date of the wrong
     instant: from 3 Oct, Previous day derived 2026-10-01T18:30Z whose UTC
     date is still the 1st → the stepper double-jumped 3→1, and Next day
     from 1 Oct was a NO-OP (round 118's "automation double-click" was this
     bug, not the tool). Anchoring at NOON IST keeps ±1 UTC day safely
     inside the neighbouring IST calendar date. */
  const d = new Date(`${dateIso}T12:00:00+05:30`);"""
new_shift = """function shiftDay(dateIso: string, days: number): string {
  /* v5.83.0 — day arithmetic, fixed. The old anchor (midnight IST =
     18:30Z on the PREVIOUS UTC date) shifted the UTC date of the wrong
     instant: from 3 Oct, Previous day derived 2026-10-01T18:30Z whose UTC
     date is still the 1st → the stepper double-jumped 3→1, and Next day
     from 1 Oct was a NO-OP (round 118's "automation double-click" was this
     bug, not the tool). Anchoring at NOON keeps ±1 UTC day safely inside
     the neighbouring calendar date — a pure date-STRING shift, so it is
     timezone-agnostic. */
  const d = new Date(`${dateIso}T12:00:00Z`);"""
assert old_shift in s
s = s.replace(old_shift, new_shift)

# 3. prettyDay: midnight via the lib, zone via the setting.
old_pretty = """function prettyDay(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** HH:MM in IST for a stored timestamptz. */
function istTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}"""
new_pretty = """function prettyDay(dateIso: string): string {
  const d = new Date(appDayStartMs(dateIso));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: appTimezone(),
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/** HH:MM in the reporting timezone for a stored timestamptz. */
function istTime(iso: string): string {
  return appFormatters().hhmm.format(new Date(iso));
}"""
assert old_pretty in s
s = s.replace(old_pretty, new_pretty)

# 4. Z-report slip: zone name + printed-at tag.
old_slip = "<div>${prettyDay(opts.dateIso)} · Asia/Kolkata</div>"
new_slip = "<div>${prettyDay(opts.dateIso)} · ${appTimezone()}</div>"
assert old_slip in s
s = s.replace(old_slip, new_slip)

old_printed = "Printed ${new Intl.DateTimeFormat('en-IN', { timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())} IST$"
new_printed = "Printed ${appFormatters().hhmm.format(new Date())} ${appTzTag()}$"
assert old_printed in s
s = s.replace(old_printed, new_printed)

# 5. Visible shift/drawer words + CSV header.
pairs = [
    ("Opened {istTime(active.opened_at)} IST · {active.opened_by_email || 'counter'}",
     "Opened {istTime(active.opened_at)} {appTzTag()} · {active.opened_by_email || 'counter'}"),
    ("[`Opened ${istTime(drawerActive.opened_at)} IST`, drawerActive.opened_by_email || 'counter'],",
     "[`Opened ${istTime(drawerActive.opened_at)} ${appTzTag()}`, drawerActive.opened_by_email || 'counter'],"),
    ("['Ticket', 'Time (IST)', 'Type', 'Status', 'Payment', 'Method', 'Customer', 'Total', 'Tax', 'COGS'],",
     "['Ticket', `Time (${appTzTag()})`, 'Type', 'Status', 'Payment', 'Method', 'Customer', 'Total', 'Tax', 'COGS'],"),
    ("as of {istTime(refreshedAt.toISOString())} IST",
     "as of {istTime(refreshedAt.toISOString())} {appTzTag()}"),
    ("     book straight onto that IST day. The initializer only PEEKS at the",
     "     book straight onto that reporting day. The initializer only PEEKS at the"),
    ("     Fetched ONCE per tenant (200 latest); the selected IST day filters",
     "     Fetched ONCE per tenant (200 latest); the selected reporting day filters"),
    (" * Day stepper (Asia/Kolkata calendar days) → day summary (orders, gross,",
     " * Day stepper (the Settings reporting day — Asia/Kolkata by default) →\n * day summary (orders, gross,"),
]
for old, new in pairs:
    assert old in s, f'missing: {old[:60]}'
    s = s.replace(old, new)

# 6. Wrapper: live refetch on prefs change.
old_wrap = """export const EodScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  return <EodScreenInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};"""
new_wrap = """export const EodScreen: React.FC = () => {
  const [attempt, setAttempt] = useState(0);
  /* 5.97.0 — the owner's timezone word takes effect live: a Settings save
     re-opens the day book in the chosen day. */
  useEffect(() => subscribePrefs(() => setAttempt((a) => a + 1)), []);
  return <EodScreenInner key={attempt} onTenantRetry={() => setAttempt((a) => a + 1)} />;
};"""
assert old_wrap in s
s = s.replace(old_wrap, new_wrap)

open(p, 'w').write(s)
print('EOD patched OK')
