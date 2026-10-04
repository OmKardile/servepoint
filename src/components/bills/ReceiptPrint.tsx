import { formatMoney } from '../../lib/prefs';
import { printHiddenFrame } from '../../lib/printFrame';
import { BOOKING_TZ } from '../../lib/bookingday';

/**
 * Customer receipt — thermal 80mm print view (Task 49).
 * Mirrors the Z-report print pattern in EodScreen (hidden iframe → print),
 * but the money block is the TICKET's own truth: every figure below is a
 * stored column on orders — subtotal, discount_amount, tax_amount, total —
 * never recomputed. The CGST/SGST split is a display-only halving of the
 * stored tax_amount (sums back exactly); India restaurant bills print the
 * 5% GST as 2.5% + 2.5%.
 */

/* v5.106.0 — the receipt is a legal record, so it keeps the DB's clock
 * (BOOKING_TZ, the same Asia/Kolkata that migrations 030/032 compose in and
 * India's GST filings speak). It deliberately does NOT follow the owner's
 * reporting-timezone choice — a printed tax document must not shift with a
 * settings toggle. The printed "IST" suffix stays unconditional: correct. */

export interface ReceiptItem {
  name: string;
  qty: number;
  variantName?: string | null;
  notes?: string | null;
  addons?: { name: string; price: number }[] | null;
  /** Frozen line total (addons included) — falls back to unit_price × qty upstream. */
  lineTotal: number;
}

export interface ReceiptOpts {
  storeName: string;
  orderNumber: number | string;
  orderType: string;
  tableLabel?: string | null;
  customerName?: string | null;
  createdAt: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number | null;
  offerTitle?: string | null;
  tax: number;
  total: number;
  /** e.g. 'UPI' / 'Cash' / 'Bank Card' — resolved by the caller (ledger → orders fallback). */
  paymentLabel: string | null;
  paidAt?: string | null;
  isPaid: boolean;
  /** 5.63.0 split bills — every ledger row of a settled ticket, oldest first.
   *  Present with 2+ rows → the payment block prints one PAID line per part
   *  instead of the single-method line. Absent/1 row → byte-identical receipt. */
  splitPayments?: { label: string; amount: number }[] | null;
  printedBy?: string | null;
  /** v5.29.0 — the café's face (migration 024's logo_url) atop the receipt
   *  header. NULL/absent → byte-identical pre-5.29 header: no tile, no
   *  placeholder. A dead URL hides its own tile at print time (onerror), and
   *  the caller preloads the image so a cold remote never prints a hole. */
  logoUrl?: string | null;
  /** Task 90 — the legal identity block. Every field is optional and only
   *  prints when present; with ALL absent the receipt is byte-identical to
   *  the pre-5.51 header. GSTIN present → the document becomes a TAX
   *  INVOICE (India: a bill carrying GSTIN is a tax invoice). */
  legalName?: string | null;
  gstNumber?: string | null;
  fssaiNumber?: string | null;
  address?: string | null;
  phone?: string | null;
}

const esc = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const istDateTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: BOOKING_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const istTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: BOOKING_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

/** Pure builder — exported so browser E2E can assert the exact receipt HTML
 * without going through window.print(). */
export function buildReceiptHtml(opts: ReceiptOpts): string {
  const row = (l: string, r: string, strong = false) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:2.5px 0;${strong ? 'font-weight:800;' : ''}"><span>${l}</span><span style="font-variant-numeric:tabular-nums;white-space:nowrap;">${r}</span></div>`;

  const itemRows = opts.items
    .map((it) => {
      const head = `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;"><span style="font-weight:700;">${esc(it.name)}<span style="font-weight:400;"> ×${it.qty}</span></span><span style="font-variant-numeric:tabular-nums;white-space:nowrap;">${formatMoney(it.lineTotal)}</span></div>`;
      const subs: string[] = [];
      if (it.variantName) subs.push(esc(it.variantName));
      for (const a of it.addons || []) subs.push(`+ ${esc(a.name)}`);
      if (it.notes) subs.push(`&#8226; ${esc(it.notes)}`);
      const sub =
        subs.length > 0
          ? `<div style="color:#444;padding:0 0 2px 12px;">${subs.join('<br/>')}</div>`
          : '';
      return head + sub;
    })
    .join('');

  const cgst = Math.round((opts.tax / 2) * 100) / 100;
  const sgst = Math.round((opts.tax - cgst) * 100) / 100;
  const discount = Number(opts.discount ?? 0);

  const discountRow =
    discount > 0
      ? row(
          `DISCOUNT${opts.offerTitle ? ` · ${esc(opts.offerTitle)}` : ''}`,
          `-${formatMoney(discount)}`,
        )
      : '';

  const split = (opts.splitPayments || []).filter((p) => p.amount > 0);
  const paymentBlock = opts.isPaid
    ? split.length > 1
      ? `${split
          .map((p) => row(`PAID · ${esc(p.label)}`, formatMoney(p.amount)))
          .join('')}${row(
          'SETTLED',
          opts.paidAt ? istTime(opts.paidAt) : '',
          true,
        )}`
      : row(
          `PAID${opts.paymentLabel ? ` · ${esc(opts.paymentLabel)}` : ''}`,
          opts.paidAt ? istTime(opts.paidAt) : '',
          true,
        )
    : `<div style="padding:2.5px 0;font-weight:800;">PAYMENT DUE</div>`;

  const metaBits = [
    ORDER_TYPE_LABEL[String(opts.orderType)] || esc(String(opts.orderType)),
    opts.tableLabel ? esc(opts.tableLabel) : '',
    opts.customerName ? esc(opts.customerName) : '',
  ].filter(Boolean);

  /* Task 90 — legal identity lines. Order reads like an Indian bill: who
   * (trade name) → the entity behind it → where → how to reach → the two
   * licence numbers the law wants on paper. Only present fields print; the
   * GSTIN/FSSAI codes carry extra letter-spacing so a hand-keyed digit is
   * visible at arm's length. */
  const legalName =
    opts.legalName && opts.legalName.trim() !== '' && opts.legalName.trim() !== opts.storeName
      ? `<div style="margin-top:2px;font-size:11px;font-weight:600;">${esc(opts.legalName.trim())}</div>`
      : '';
  const address =
    opts.address && opts.address.trim() !== ''
      ? `<div style="margin-top:2px;font-size:10.5px;color:#333;">${esc(opts.address.trim())}</div>`
      : '';
  const phone =
    opts.phone && opts.phone.trim() !== ''
      ? `<div style="margin-top:1px;font-size:10.5px;color:#333;">${esc(opts.phone.trim())}</div>`
      : '';
  const gstin =
    opts.gstNumber && opts.gstNumber.trim() !== ''
      ? `<div style="margin-top:4px;font-size:10.5px;letter-spacing:1px;font-variant-numeric:tabular-nums;">GSTIN: ${esc(opts.gstNumber.trim().toUpperCase())}</div>`
      : '';
  const fssai =
    opts.fssaiNumber && opts.fssaiNumber.trim() !== ''
      ? `<div style="margin-top:1px;font-size:10.5px;letter-spacing:1px;font-variant-numeric:tabular-nums;">FSSAI Lic. No: ${esc(opts.fssaiNumber.trim())}</div>`
      : '';
  const docTitle = opts.gstNumber && opts.gstNumber.trim() !== '' ? 'TAX INVOICE' : 'CUSTOMER RECEIPT';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${esc(String(opts.orderNumber))}</title></head>
<body style="font-family:'Courier New',monospace;color:#000;margin:0;padding:16px 12px;width:302px;font-size:12px;">
  <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
    ${opts.logoUrl ? `<img src="${esc(opts.logoUrl)}" alt="" onerror="this.style.display='none'" style="display:block;margin:0 auto 6px;max-height:44px;max-width:120px;object-fit:contain;"/>` : ''}
    <div style="font-size:15px;font-weight:800;letter-spacing:1px;">${esc(opts.storeName)}</div>
    ${legalName}${address}${phone}${gstin}${fssai}
    <div style="margin-top:2px;">${docTitle}</div>
    <div>#${esc(String(opts.orderNumber))}${metaBits.length > 0 ? ` · ${metaBits.join(' · ')}` : ''}</div>
    <div>${istDateTime(opts.createdAt)} IST</div>
  </div>
  <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;">
    ${itemRows || '<div style="padding:3px 0;color:#444;">No item lines recorded.</div>'}
  </div>
  <div style="border-bottom:1px dashed #000;padding:6px 0;">
    ${row('Subtotal', formatMoney(opts.subtotal))}
    ${discountRow}
    ${row('CGST 2.5%', formatMoney(cgst))}
    ${row('SGST 2.5%', formatMoney(sgst))}
    ${row('TOTAL', formatMoney(opts.total), true)}
    <div style="border-top:1px dashed #000;margin:6px 0 2px;"></div>
    ${paymentBlock}
  </div>
  <div style="text-align:center;color:#333;padding-top:8px;">
    <div style="font-weight:700;">Thank you! Visit again.</div>
    <div style="margin-top:6px;">Printed ${istDateTime(new Date().toISOString())} IST${opts.printedBy ? ` · ${esc(opts.printedBy)}` : ''}</div>
    <div style="margin-top:6px;letter-spacing:2px;">· · · servepoint · · ·</div>
  </div>
</body></html>`;
}

/** Hidden-iframe print — same engine path as the EOD Z-report and the
 *  floor's QR sticker sheet (shared afterprint-safe lifecycle).
 *  v5.29.0: the caller preloads `logoUrl` first (preloadPrintImage) so a
 *  cold remote image never prints as a hole in the header. */
export function printReceipt(opts: ReceiptOpts): void {
  printHiddenFrame(buildReceiptHtml(opts));
}

/**
 * v5.145.0 — the bill's chat voice. The SAME ReceiptOpts the thermal print
 * consumes, rendered as aligned plain text for Copy / WhatsApp share —
 * every figure from the same stored columns (never recomputed), the same
 * CGST/SGST display halving, the same PAID/split/PAYMENT DUE semantics, the
 * same legal-identity lines when present. The logo has no chat form and is
 * deliberately absent; the words carry the bill (the offline page's rule).
 * Text width targets a 32-column monospace frame — WhatsApp renders it
 * proportionally, where the right column may drift but the rows stay
 * readable. Exported pure like buildReceiptHtml so browser E2E can assert
 * the exact share text without touching the clipboard.
 */
export function buildReceiptText(opts: ReceiptOpts): string {
  const W = 32;
  const two = (l: string, r: string): string => {
    const cut = Math.max(1, W - r.length - 1);
    const left = l.length > cut ? `${l.slice(0, cut - 1)}…` : l;
    return left.padEnd(W - r.length, ' ') + r;
  };
  const hr = '-'.repeat(W);
  const center = (s: string): string => {
    const t = s.length > W ? `${s.slice(0, W - 1)}…` : s;
    return t.length >= W ? t : ' '.repeat(Math.floor((W - t.length) / 2)) + t;
  };

  const cgst = Math.round((opts.tax / 2) * 100) / 100;
  const sgst = Math.round((opts.tax - cgst) * 100) / 100;
  const discount = Number(opts.discount ?? 0);

  const out: string[] = [];
  out.push(center(opts.storeName.toUpperCase()));
  const legal = opts.legalName && opts.legalName.trim() !== '' && opts.legalName.trim() !== opts.storeName ? opts.legalName.trim() : '';
  if (legal) out.push(center(legal));
  if (opts.address && opts.address.trim() !== '') out.push(center(opts.address.trim()));
  if (opts.phone && opts.phone.trim() !== '') out.push(center(opts.phone.trim()));
  if (opts.gstNumber && opts.gstNumber.trim() !== '') out.push(center(`GSTIN: ${opts.gstNumber.trim().toUpperCase()}`));
  if (opts.fssaiNumber && opts.fssaiNumber.trim() !== '') out.push(center(`FSSAI Lic. No: ${opts.fssaiNumber.trim()}`));
  out.push(center(opts.gstNumber && opts.gstNumber.trim() !== '' ? 'TAX INVOICE' : 'CUSTOMER RECEIPT'));

  const metaBits = [
    ORDER_TYPE_LABEL[String(opts.orderType)] || String(opts.orderType),
    opts.tableLabel || '',
    opts.customerName || '',
  ].filter(Boolean);
  out.push(`#${opts.orderNumber}${metaBits.length > 0 ? ` · ${metaBits.join(' · ')}` : ''}`);
  out.push(`${istDateTime(opts.createdAt)} IST`);
  out.push(hr);

  if (opts.items.length === 0) {
    out.push('No item lines recorded.');
  } else {
    for (const it of opts.items) {
      out.push(two(`${it.name} x${it.qty}`, formatMoney(it.lineTotal)));
      const subs: string[] = [];
      if (it.variantName) subs.push(it.variantName);
      for (const a of it.addons || []) subs.push(`+ ${a.name}`);
      if (it.notes) subs.push(`- ${it.notes}`);
      for (const s of subs) out.push(`  ${s}`);
    }
  }
  out.push(hr);
  out.push(two('Subtotal', formatMoney(opts.subtotal)));
  if (discount > 0) out.push(two(`DISCOUNT${opts.offerTitle ? ` - ${opts.offerTitle}` : ''}`, `-${formatMoney(discount)}`));
  out.push(two('CGST 2.5%', formatMoney(cgst)));
  out.push(two('SGST 2.5%', formatMoney(sgst)));
  out.push(two('TOTAL', formatMoney(opts.total)));
  out.push(hr);

  const split = (opts.splitPayments || []).filter((p) => p.amount > 0);
  if (opts.isPaid) {
    if (split.length > 1) {
      for (const p of split) out.push(two(`PAID - ${p.label}`, formatMoney(p.amount)));
      out.push(two('SETTLED', opts.paidAt ? istTime(opts.paidAt) : ''));
    } else {
      out.push(two(`PAID${opts.paymentLabel ? ` - ${opts.paymentLabel}` : ''}`, opts.paidAt ? istTime(opts.paidAt) : ''));
    }
  } else {
    out.push('PAYMENT DUE');
  }
  out.push(hr);
  out.push(center('Thank you! Visit again.'));
  return out.join('\n');
}
