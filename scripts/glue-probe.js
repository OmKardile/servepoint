/* The a11y-glue probe (Task 280) — finds elements whose textContent is
 * MISSING whitespace between its children (JSX stripped the inter-node
 * newline), while a space-joined reading would be the honest name.
 * Paste into agent-browser eval per room; returns suspects with a
 * flex-context annotation (flex-gap containers are the blessed family
 * per the 5.237 verdict — accName computation inserts spaces there). */
(() => {
  const out = [];
  const seen = new Set();
  const els = document.querySelectorAll(
    'main h1,main h2,main h3,main h4,main button,main label,main a,main th,main legend'
  );
  els.forEach((el) => {
    if (el.closest('[aria-hidden="true"]')) return;
    const kids = Array.from(el.childNodes)
      .map((n) => (n.nodeType === 3 ? n.textContent : n.textContent))
      .filter((t) => t && t.trim() !== '');
    if (kids.length < 2) return;
    const actual = el.textContent || '';
    const spaced = kids.map((t) => t.trim()).join(' ');
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    if (norm(actual) === norm(spaced)) return;
    const flexSelf = /flex/.test(el.className || '');
    const flexParent = el.parentElement && /flex/.test(el.parentElement.className || '');
    const key = norm(actual).slice(0, 70);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      tag: el.tagName.toLowerCase(),
      text: key,
      want: norm(spaced).slice(0, 70),
      flex: flexSelf ? 'self' : flexParent ? 'parent' : 'no',
    });
  });
  return out
    .map((x) => `[${x.tag}|flex:${x.flex}] "${x.text}"  => want "${x.want}"`)
    .join('\n');
})();
