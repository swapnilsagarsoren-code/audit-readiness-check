import { checkPasscode, istHour } from '../shared/passcode';

const TWO_HOURS = 2 * 3_600_000;

// Shared edit-passcode guard for every write. A wrong passcode is logged and a refusal is RETURNED (never thrown), because a thrown
// error would roll back the failure log and the lockout would never trigger. Records older than the lockout window are deleted here.
export async function guard(ctx: { db: any }, passcode: string) {
  const now = Date.now();
  for (const old of await ctx.db.query('editAttempt').withIndex('by_at', (q: any) => q.lt('at', now - TWO_HOURS)).collect()) await ctx.db.delete(old._id);
  const recent = (await ctx.db.query('editAttempt').withIndex('by_at', (q: any) => q.gte('at', now - TWO_HOURS)).collect()).map((r: { at: number }) => r.at);
  const result = checkPasscode(passcode, process.env.EDIT_PASSCODE, recent, now);
  if (result === 'wrong') await ctx.db.insert('editAttempt', { at: now });
  return { result, hour: istHour(now) };
}
