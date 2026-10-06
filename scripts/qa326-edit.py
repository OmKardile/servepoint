#!/usr/bin/env python3
"""Task 326 — v5.287.0 "the console's tables learn their belt".
Surgical edits to PlatformScreen.tsx:
  THE BELT (fix): both desktop tables' crossover md: -> lg: (the stacked
    cards own the squeezed 768-1023 band where the rail eats 228px and the
    tables clipped silently — measured at 768: 474px of card vs 696px of
    table, 222px of Status + Created gone with no scrollbar and no
    ellipsis), and an inner overflow-x-auto belt (the EOD escape's own
    convention) guarantees any future crunch degrades to a scroll.
  THE HANDOVER (feature): the businesses table's owner-email cell learns
    to copy — CopyValueButton rides beside the truncated address with
    stopRowClick (the row's expand must not fire); the verb rides the one
    copy breath (useCopyAck), zero new clipboard code.
Every replacement asserts its exact count — read-the-actual-shape law.
"""
import sys

P = '/home/z/my-project/src/components/platform/PlatformScreen.tsx'
src = open(P, encoding='utf-8').read()
orig = src


def must_replace(s, old, new, n=1):
    c = s.count(old)
    assert c == n, f"expected {n} occurrence(s) of {old[:70]!r}..., found {c}"
    return s.replace(old, new)


# ---------- R1: businesses desktop table — crossover + belt open ----------
src = must_replace(src,
    '          {/* Desktop table */}\n'
    '          <div className="sp-card hidden overflow-hidden md:block">\n'
    '            <table className="w-full text-left text-sm">',

    '          {/* Desktop table — v5.287.0 "the console\'s tables learn\n'
    '              their belt": the crossover learns the rail\'s own appetite.\n'
    '              Below lg the rail eats 228px and this table\'s columns\n'
    '              clipped silently (measured at 768: 474px of card vs 696px\n'
    '              of table — Status and Created simply vanished,\n'
    '              overflow-hidden, no scrollbar, no ellipsis). The stacked\n'
    '              cards — already proven at the phone — own the band below\n'
    '              lg; the table owns lg and above, and the belt below\n'
    '              (overflow-x-auto, the EOD escape\'s own convention)\n'
    '              guarantees any future crunch degrades to a scroll, never\n'
    '              a silent clip. */}\n'
    '          <div className="sp-card hidden overflow-hidden lg:block">\n'
    '            <div className="overflow-x-auto [scrollbar-width:thin]">\n'
    '            <table className="w-full text-left text-sm">')

# ---------- R2: businesses table tail — close the belt ----------
src = must_replace(src,
    '            </table>\n'
    '          </div>',

    '            </table>\n'
    '            </div>\n'
    '          </div>')

# ---------- R3: subscriptions desktop table — crossover + belt open ----------
src = must_replace(src,
    '            {/* Desktop table */}\n'
    '            <div className="sp-card hidden overflow-hidden md:block">\n'
    '              <table className="w-full text-left text-sm">',

    '            {/* Desktop table — the same belt the businesses table\n'
    '                wears (v5.287.0): seven columns and a whitespace-nowrap\n'
    '                tail clipped Final rate at the card\'s own edge at 768;\n'
    '                the cards own the band below lg, the belt keeps lg+\n'
    '                honest forever. */}\n'
    '            <div className="sp-card hidden overflow-hidden lg:block">\n'
    '              <div className="overflow-x-auto [scrollbar-width:thin]">\n'
    '              <table className="w-full text-left text-sm">')

# ---------- R4: subscriptions table tail — close the belt ----------
src = must_replace(src,
    '              </table>\n'
    '            </div>',

    '              </table>\n'
    '              </div>\n'
    '            </div>')

# ---------- R5: businesses stacked cards crossover ----------
src = must_replace(src,
    '          {/* Mobile stacked cards */}\n'
    '          <div className="space-y-3 md:hidden">',

    '          {/* Mobile stacked cards — the crossover climbs with the\n'
    '              table\'s (v5.287.0): these cards own everything below lg. */}\n'
    '          <div className="space-y-3 lg:hidden">')

# ---------- R6: subscriptions stacked cards crossover ----------
src = must_replace(src,
    '            {/* Mobile stacked cards */}\n'
    '            <div className="space-y-3 md:hidden">',

    '            {/* Mobile stacked cards — the crossover climbs with the\n'
    '                table\'s (v5.287.0). */}\n'
    '            <div className="space-y-3 lg:hidden">')

# ---------- R7: CopyValueButton learns stopRowClick (the handover's prop) ----------
src = must_replace(src,
    'const CopyValueButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {',

    'const CopyValueButton: React.FC<{ value: string; label: string; stopRowClick?: boolean }> = ({\n'
    '  value,\n'
    '  label,\n'
    '  stopRowClick,\n'
    '}) => {')

src = must_replace(src,
    '      onClick={() => runCopy(value)}',

    '      onClick={(e) => {\n'
    '        /* v5.287.0 — stopRowClick: inside the businesses table\'s row\n'
    '         * the copy tap must not fire the row\'s expand. */\n'
    '        if (stopRowClick) e.stopPropagation();\n'
    '        runCopy(value);\n'
    '      }}')

# ---------- R8: the email cell — the handover itself ----------
src = must_replace(src,
    '                        <td className="max-w-[220px] truncate px-4 py-3.5 text-[#6B6B6B]">{t.owner_email || \'—\'}</td>',

    '                        <td className="max-w-[220px] px-4 py-3.5 text-[#6B6B6B]">\n'
    '                          {/* v5.287.0 — the handover: the email learns to\n'
    '                              leave the row. The verb rides the one copy\n'
    '                              breath (useCopyAck via CopyValueButton) and\n'
    '                              stopRowClick keeps the row\'s expand out of\n'
    '                              the tap; the address keeps truncate + title\n'
    '                              so a long email never reflows the row, and\n'
    '                              the button never squeezes (shrink-0 in the\n'
    '                              verb\'s own classes). The full address and\n'
    '                              its verdict still live in the detail panel\n'
    '                              below — this is the one-tap shortcut, not a\n'
    '                              second grammar. */}\n'
    '                          <span className="flex items-center gap-1">\n'
    '                            <span className="min-w-0 truncate" title={t.owner_email || undefined}>\n'
    '                              {t.owner_email || \'—\'}\n'
    '                            </span>\n'
    '                            {t.owner_email && (\n'
    '                              <CopyValueButton value={t.owner_email} label="Owner email" stopRowClick />\n'
    '                            )}\n'
    '                          </span>\n'
    '                        </td>')

assert src != orig
open(P, 'w', encoding='utf-8').write(src)
print("PlatformScreen.tsx: 8 replacements applied OK")
