import { guard } from './guard';
import { constantTimeEqual, istHour, MAX_FAILURES_PER_HOUR } from '../shared/passcode';
import { hashCode, isSessionId, isValidCode, LIMITS } from '../shared/visitor';

// Story-mode visitors. Each browser holds a random session id; the sign-off code is kept only as a salted hash.
// Like guard(), every refusal is returned and never thrown, so the wrong-code log survives and the lockout works.
type Ctx = { db: any };
const HOUR = 3_600_000, TWO_HOURS = 2 * HOUR, DAY = 86_400_000;
const istDay = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

export async function counter(ctx: Ctx, key: string) {
  return ctx.db.query('usageCounter').withIndex('by_key', (q: any) => q.eq('key', key)).unique();
}
export async function bump(ctx: Ctx, key: string) {
  const row = await counter(ctx, key);
  if (row) await ctx.db.replace(row._id, { key, count: row.count + 1 }); else await ctx.db.insert('usageCounter', { key, count: 1 });
}
export const sessionRow = (ctx: Ctx, sessionId: string) => ctx.db.query('visitorSession').withIndex('by_session', (q: any) => q.eq('sessionId', sessionId)).unique();

export async function startSession(ctx: Ctx, { sessionId, code }: { sessionId: string; code: string }) {
  if (!isSessionId(sessionId)) return { ok: false as const, reason: 'bad_session' };
  if (!isValidCode(code)) return { ok: false as const, reason: 'bad_code' };
  if (await sessionRow(ctx, sessionId)) return { ok: false as const, reason: 'session_exists' };
  const now = Date.now(), key = `sessions:${istDay(now)}`;
  if (((await counter(ctx, key))?.count ?? 0) >= LIMITS.newSessionsPerDay) return { ok: false as const, reason: 'busy' };
  await ctx.db.insert('visitorSession', { sessionId, codeHash: hashCode(sessionId, code), createdAt: now, expiresAt: now + LIMITS.sessionDays * DAY, saveHour: istHour(now), saves: 0 });
  await bump(ctx, key);
  return { ok: true as const };
}

export type GuardResult = 'ok' | 'wrong' | 'locked' | 'disabled' | 'no_session' | 'expired' | 'busy' | 'slow_down';

// With a session id: the visitor's own code, lockout and caps. Without one: the original EDIT_PASSCODE path for the dev screens.
export async function guardFor(ctx: Ctx, { sessionId, passcode }: { sessionId?: string; passcode: string }): Promise<{ result: GuardResult; hour: number }> {
  if (sessionId === undefined) return guard(ctx, passcode);
  const now = Date.now(), hour = istHour(now);
  const s = await sessionRow(ctx, sessionId);
  if (!s) return { result: 'no_session', hour };
  if (s.expiresAt < now) return { result: 'expired', hour };
  // Wrong codes count toward the daily write cap too, so one script cannot fill the attempt log without limit.
  const writesKey = `writes:${istDay(now)}`;
  if (((await counter(ctx, writesKey))?.count ?? 0) >= LIMITS.writesPerDay) return { result: 'busy', hour };
  // Only this session's own log is read and pruned here: at most about 20 rows, so one call never touches other visitors' rows.
  const mine = await ctx.db.query('visitorAttempt').withIndex('by_session', (q: any) => q.eq('sessionId', sessionId)).collect();
  for (const old of mine.filter((r: { at: number }) => r.at < now - TWO_HOURS)) await ctx.db.delete(old._id);
  if (mine.filter((r: { at: number }) => istHour(r.at) === hour).length >= MAX_FAILURES_PER_HOUR) return { result: 'locked', hour };
  if (!constantTimeEqual(hashCode(sessionId, passcode), s.codeHash)) {
    await ctx.db.insert('visitorAttempt', { sessionId, at: now });
    await bump(ctx, writesKey);
    return { result: 'wrong', hour };
  }
  const saves = s.saveHour === hour ? s.saves : 0;
  if (saves >= LIMITS.savesPerSessionPerHour) return { result: 'slow_down', hour };
  const { _id, _creationTime, ...rest } = s;
  await ctx.db.replace(_id, { ...rest, saveHour: hour, saves: saves + 1 });
  await bump(ctx, writesKey);
  return { result: 'ok', hour };
}

// Daily: delete sessions past their expiry with every row they own, a bounded batch per run so a backlog can never
// push one mutation past Convex's read and write limits. `more` tells the caller to schedule the next batch.
export const CLEANUP_BATCH = 100;
export async function cleanupExpired(ctx: Ctx, tables: string[]) {
  const now = Date.now();
  const expired = await ctx.db.query('visitorSession').withIndex('by_expires', (q: any) => q.lt('expiresAt', now)).take(CLEANUP_BATCH);
  for (const s of expired) {
    for (const r of await ctx.db.query('visitorAttempt').withIndex('by_session', (q: any) => q.eq('sessionId', s.sessionId)).collect()) await ctx.db.delete(r._id);
    for (const t of tables) for (const r of await ctx.db.query(t).withIndex('by_session_flag', (q: any) => q.eq('sessionId', s.sessionId)).collect()) await ctx.db.delete(r._id);
    await ctx.db.delete(s._id);
  }
  return { sessions: expired.length, more: expired.length === CLEANUP_BATCH };
}
