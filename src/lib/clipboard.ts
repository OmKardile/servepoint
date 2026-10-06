/* v5.276.0 — the copy's ONE door. A census over the whole house's
 * clipboard renders found FOUR hand-rolled helpers (settings, support,
 * the platform page, the wizard — each carrying its own fallback copy)
 * and FIFTEEN verbs that spoke the raw API: `navigator.clipboard` is
 * undefined on a non-secure origin, and the house's real deployment is
 * LAN counter tablets on plain HTTP — so every one of those verbs was
 * DEAD there: the throw-guards said "Copy blocked" forever, the floor's
 * silent copies did nothing at all, and the guest's copy-link button
 * said "Copied" without having copied anything. THE ONE DOOR: the async
 * Clipboard API when the origin is secure, and the select-and-execCommand
 * textarea fallback when it is not — one honest boolean out the other
 * side. Every copy verb in the house rides this word; the census law
 * below the lib says no OTHER navigator.clipboard reference may exist
 * in src/ (unit315 walks it). */

/** true when the text is on the clipboard; false when both doors
 *  refused — the caller's own fail word decides what the surface says.
 *  Never throws: a refused copy is an ANSWER, not an exception. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
