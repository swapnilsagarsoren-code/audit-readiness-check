// Edit passcode check with the AGENTS.md lockout: 10 wrong passcodes in one India clock hour lock all edits.
export const MAX_FAILURES_PER_HOUR = 10;
const IST_OFFSET_MS = 330 * 60_000;
export const istHour = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / 3_600_000);

export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// An unset or empty expected passcode disables every edit. A locked hour refuses even the right passcode.
export function checkPasscode(supplied: string, expected: string | undefined, failureTimes: number[], now: number): 'ok' | 'wrong' | 'locked' | 'disabled' {
  if (!expected) return 'disabled';
  const hour = istHour(now);
  if (failureTimes.filter(t => istHour(t) === hour).length >= MAX_FAILURES_PER_HOUR) return 'locked';
  return constantTimeEqual(supplied, expected) ? 'ok' : 'wrong';
}
