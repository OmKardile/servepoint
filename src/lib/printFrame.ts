/**
 * Hidden-iframe print — the ONE shared engine path for the receipt
 * (ReceiptPrint), the EOD Z-report and the floor's QR sticker sheet.
 *
 * Why the old per-file `setTimeout(removeChild, 1500)` was wrong: engines
 * whose print() doesn't block (Firefox) return immediately, so the blind
 * removal could rip the document out from under a still-open print dialog —
 * aborted or blank jobs. The engine's own afterprint event is the honest
 * "done" signal; the 60s fallback only catches engines that never fire it
 * (headless / no-op print in test browsers), and a thrown print() no longer
 * leaks the frame. (v5.27.1 daily-hardening)
 */
export function printHiddenFrame(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    if (frame.parentNode) document.body.removeChild(frame);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  win.focus();

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    if (frame.parentNode) document.body.removeChild(frame);
  };
  win.addEventListener('afterprint', remove);
  window.setTimeout(remove, 60000);

  try {
    win.print();
  } catch {
    remove();
  }
}

/**
 * Warm a remote image (the café logo) BEFORE the hidden iframe prints —
 * window.print() does not wait for a cold <img> to download, so a cold or
 * dead URL would otherwise print a sheet with a hole (or nothing) where the
 * logo should be. Resolves false on error/timeout (2.5s default) and the
 * caller just prints — the frame's own onerror self-hide keeps the output
 * honest either way. Shared by the sticker sheet and the receipt header.
 * (v5.29.0)
 */
export function preloadPrintImage(url: string, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}
