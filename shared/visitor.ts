import { sha256Hex } from './sha256';

// Public story-mode visitors: one random session per browser, a sign-off code the visitor picks, and low caps.
export const LIMITS = {
  sessionDays: 7,
  newSessionsPerDay: 500,
  savesPerSessionPerHour: 60,
  writesPerDay: 5000,
  hashRounds: 1000,
} as const;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isSessionId = (id: string) => UUID_V4.test(id);
export const isValidCode = (code: string) => typeof code === 'string' && code.length >= 4 && code.length <= 20;

// Salted by the session id and stretched, so the stored value is never the code and differs between sessions.
export function hashCode(sessionId: string, code: string): string {
  let h = sha256Hex(`${sessionId}:${code}`);
  for (let i = 1; i < LIMITS.hashRounds; i++) h = sha256Hex(`${sessionId}:${h}`);
  return h;
}
