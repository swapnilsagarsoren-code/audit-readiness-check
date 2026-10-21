// Story mode keeps one random session id per browser tab. The sign-off code is never stored; the visitor types it each time.
const KEY = 'nf-story-session';
export function readSession(): string | null {
  try { return globalThis.sessionStorage?.getItem(KEY) ?? null; } catch { return null; }
}
export function saveSession(id: string) {
  try { globalThis.sessionStorage?.setItem(KEY, id); } catch { /* storage blocked: the session lasts until the page closes */ }
}
export function clearSession() {
  try { globalThis.sessionStorage?.removeItem(KEY); } catch { /* storage blocked: nothing was kept */ }
}

// Play again: forget this tab's session and return to the briefing.
export function playAgain() {
  clearSession();
  globalThis.location.hash = '#/story';
}

export type Route = { kind: 'home' } | { kind: 'gap'; flagKey: string } | { kind: 'story' } | { kind: 'case'; flagKey: string } | { kind: 'debrief' } | { kind: 'company' };
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return ''; } };
// The public build (VITE_STORY=1) opens on the story; the dev build opens on the gaps list.
export function parseRoute(hash: string, storyHome: boolean): Route {
  if (hash.startsWith('#/gap/')) return { kind: 'gap', flagKey: decode(hash.slice(6)) };
  if (hash.startsWith('#/story/case/')) return { kind: 'case', flagKey: decode(hash.slice(13)) };
  if (hash === '#/story/debrief') return { kind: 'debrief' };
  if (hash === '#/story/company') return { kind: 'company' };
  if (hash.startsWith('#/story')) return { kind: 'story' };
  return storyHome ? { kind: 'story' } : { kind: 'home' };
}
