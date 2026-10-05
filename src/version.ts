/* v5.235.0 — the ONE version word. The service worker bakes the same word
 * into its cache name (public/sw.js's own copy — unit274 pins the two agree,
 * so a forgotten bump fails the gate), and the shell speaks it (the sidebar
 * footer's build word) so support can ask "which build?" and the app
 * answers. Bump BOTH this file and public/sw.js on every release. */
export const APP_VERSION = '5.264.0';
