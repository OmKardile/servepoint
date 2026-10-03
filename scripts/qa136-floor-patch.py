import re

p = '/home/z/my-project/src/components/floor/FloorScreen.tsx'
s = open(p).read()

# 1. Import the lib.
old_imp = "import { formatMoney } from '../../lib/prefs';"
new_imp = (
    "import { formatMoney } from '../../lib/prefs';\n"
    "import {\n"
    "  appTimezone,\n"
    "  appTodayIso,\n"
    "  appDayStartMs,\n"
    "  appHour,\n"
    "  appDayKey,\n"
    "  appFormatters,\n"
    "  appTzTag,\n"
    "} from '../../lib/appday';"
)
assert old_imp in s
s = s.replace(old_imp, new_imp)

# 2. Helper block: swap bodies to lib delegates.
pat = re.compile(
    r"/\* ─+ IST hour math for the floor rhythm strip \(v5\.22\.0\) — same calendar\n"
    r"   math as Reports' Sales-by-hour: Asia/Kolkata hours on real IST days\. ─+ \*/\n"
    r"const IST_TZ = 'Asia/Kolkata';\n\n"
    r"function istHour\(iso: string\): number \{\n"
    r"  const h = new Intl\.DateTimeFormat\('en-GB', \{\n"
    r"    timeZone: IST_TZ,\n"
    r"    hour: '2-digit',\n"
    r"    hour12: false,\n"
    r"  \}\)\.format\(new Date\(iso\)\);\n"
    r"  return Number\(h\) % 24;\n\}\n\n"
    r"/\*\* YYYY-MM-DD of an ISO instant, in IST\. \*/\n"
    r"function istDateKey\(iso: string\): string \{\n"
    r"  return new Intl\.DateTimeFormat\('en-CA', \{\n"
    r"    timeZone: IST_TZ,\n"
    r"    year: 'numeric',\n"
    r"    month: '2-digit',\n"
    r"    day: '2-digit',\n"
    r"  \}\)\.format\(new Date\(iso\)\);\n\}\n\n"
    r"/\*\* Today's date \(YYYY-MM-DD\) in IST\. \*/\n"
    r"function istTodayIsoFloor\(\): string \{\n"
    r"  return new Intl\.DateTimeFormat\('en-CA', \{\n"
    r"    timeZone: IST_TZ,\n"
    r"    year: 'numeric',\n"
    r"    month: '2-digit',\n"
    r"    day: '2-digit',\n"
    r"  \}\)\.format\(new Date\(\)\);\n\}\n\n"
    r"/\*\* UTC-ms of IST midnight for a YYYY-MM-DD day key\. \*/\n"
    r"function istDayStartFloor\(dateIso: string\): number \{\n"
    r"  return new Date\(`\$\{dateIso\}T00:00:00\+05:30`\)\.getTime\(\);\n\}\n",
)
repl = (
    "/* ── Reporting-hour math for the floor rhythm strip (v5.22.0) — same\n"
    "   calendar math as Reports' Sales-by-hour (5.97.0: the reporting day\n"
    "   follows Settings › Timezone via src/lib/appday.ts; on every Indian\n"
    "   device these helpers are exactly IST). ── */\n\n"
    "function istHour(iso: string): number {\n"
    "  return appHour(iso);\n}\n\n"
    "/** YYYY-MM-DD of an ISO instant, in the reporting day. */\n"
    "function istDateKey(iso: string): string {\n"
    "  return appDayKey(iso);\n}\n\n"
    "/** Today's date (YYYY-MM-DD) in the reporting day. */\n"
    "function istTodayIsoFloor(): string {\n"
    "  return appTodayIso();\n}\n\n"
    "/** UTC-ms of reporting-day midnight for a YYYY-MM-DD day key. */\n"
    "function istDayStartFloor(dateIso: string): number {\n"
    "  return appDayStartMs(dateIso);\n}\n"
)
s, n = pat.subn(repl, s)
assert n == 1, f'floor helpers subn={n}'

# 3. Slot label + session clock: zone via the setting.
old_slot = """function istSlotLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))"""
new_slot = """function istSlotLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: appTimezone(),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))"""
assert old_slot in s
s = s.replace(old_slot, new_slot)

old_hm = """function istHM(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}"""
new_hm = """function istHM(iso: string): string {
  return appFormatters().hhmm.format(new Date(iso));
}"""
assert old_hm in s
s = s.replace(old_hm, new_hm)

# 4. Sticker print date: the setting's day, not a hardcoded one.
old_sticker = """  const today = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());"""
new_sticker = "  const today = appFormatters().stickerDate.format(new Date());"
assert old_sticker in s
s = s.replace(old_sticker, new_sticker)

# 5. The rhythm's spoken word.
old_cap = "<Clock size={11} aria-hidden /> IST hours · last 7 days"
new_cap = "<Clock size={11} aria-hidden /> {appTzTag()} hours · last 7 days"
assert old_cap in s
s = s.replace(old_cap, new_cap)

open(p, 'w').write(s)
print('Floor patched OK')
