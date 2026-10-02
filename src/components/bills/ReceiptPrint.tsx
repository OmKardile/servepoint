import { formatMoney } from '../../lib/prefs';
import { printHiddenFrame } from '../../lib/printFrame';

/**
 * Customer receipt — thermal 80mm print view (Task 49).
 * Mirrors the Z-report print pattern in EodScreen (hidden iframe → print),
 * but the money block is the TICKET's own truth: every figure below is a
 * stored column on orders — subtotal, discount_amount, tax_amount, total —
 * never recomputed. The CGST/SGST split is a display-only halving of the
 * stored tax_amount (sums back exactly); India restaurant bills print the
 * 5% GST as 2.5% + 2.5%.
 */

const IST_TZ = 'Asia/Kolkata';

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
  printedBy?: string | null;
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
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const istTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TZ,
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

  const paymentBlock = opts.isPaid
    ? row(
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

  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${esc(String(opts.orderNumber))}</title></head>
<body style="font-family:'Courier New',monospace;color:#000;margin:0;padding:16px 12px;width:302px;font-size:12px;">
  <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:8px;margin-bottom:8px;">
    <div style="font-size:15px;font-weight:800;letter-spacing:1px;">${esc(opts.storeName)}</div>
    <div style="margin-top:2px;">CUSTOMER RECEIPT</div>
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
 *  floor's QR sticker sheet (shared afterprint-safe lifecycle). */
export function printReceipt(opts: ReceiptOpts): void {
  printHiddenFrame(buildReceiptHtml(opts));
}
