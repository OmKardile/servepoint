/**
 * Shared CSV export (consolidated in 5.8.0 — Bills had it since 5.3.1,
 * Reports since 5.3.3, byte-identical until now).
 *
 * - Injection-safe: cells that could be read as formulas (leading = + - @)
 *   are neutralized (OWASP CSV injection guidance) — a pasted-in customer
 *   name like "=HYPERLINK(...)" can never execute from the spreadsheet.
 * - UTF-8 BOM prepended so Excel/Sheets open ₹ and Devanagari correctly.
 * - Numbers travel as bare decimals so the spreadsheet owns the formatting.
 */
export function csvCell(value: unknown): string {
  let s =
    value === null || value === undefined
      ? ''
      : String(value).replace(/\r/g, '').replace(/\n/g, ' ');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // never let a cell become a formula
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  if (rows.length === 0) return;
  const lines = rows.map((r) => r.map(csvCell).join(','));
  const blob = new Blob(['\ufeff' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
