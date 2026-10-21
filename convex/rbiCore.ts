import { parseBankRate, istDate } from '../shared/rbi-rate';
import { parseMpcSchedule, policyDates } from '../shared/mpc-schedule';
import { bump, counter, sessionRow } from './visitorCore';

// The "Check today's RBI rate" button. Cost guard: each visitor gets 3 checks per India day, a check within 6 hours of the
// last stored one reuses it, and RBI is read at most 50 times per India day for everyone. Nothing is stored unless both pages read cleanly.
type Ctx = { db: any };
export const RBI_LIMITS = { perSessionPerDay: 3, readsPerDay: 50, reuseMs: 6 * 3_600_000 } as const;
export const RBI_HOME = 'https://www.rbi.org.in/';
// RBI publishes a new schedule each March for the next financial year; this release covers 2026-27 (dated 23 Mar 2026).
export const RBI_SCHEDULE = 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62422';

export type Plan = 'fetch' | 'cached' | 'limit' | 'busy' | 'no_session' | 'expired';
export type StoredCheck = { value: number; date: string; sourceUrl: string; lastDecision: string | null; nextStart?: string; nextEnd?: string; scheduleUrl: string; scheduleFy: string };

export async function latestRate(ctx: Ctx) {
  // Button checks live in rbiCheck; rows from scripts/fetch-rbi-rate.mts live in rbiBankRate. The newest date wins, then the latest check.
  // Only the newest button check is read (by index), so the cost stays flat as checks pile up; dev script rows are few.
  const newest = await ctx.db.query('rbiCheck').withIndex('by_checked').order('desc').first();
  const rows = [...(newest ? [newest] : []), ...(await ctx.db.query('rbiBankRate').collect()).filter((r: any) => r.value !== null && r.date !== null)];
  const at = (r: any) => r.checkedAt ?? r._creationTime ?? 0;
  rows.sort((a: any, b: any) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : at(b) - at(a)));
  const r = rows[0];
  if (!r) return null;
  return {
    value: r.value as number, date: r.date as string, sourceUrl: r.sourceUrl as string, checkedAt: (r.checkedAt ?? null) as number | null,
    lastDecision: (r.lastDecision ?? null) as string | null,
    next: r.nextStart && r.nextEnd ? { start: r.nextStart as string, end: r.nextEnd as string } : null,
    scheduleFy: (r.scheduleFy ?? null) as string | null,
  };
}

export async function claimCheck(ctx: Ctx, sessionId: string): Promise<{ plan: Plan; checksLeft: number }> {
  const now = Date.now(), day = istDate(now);
  const s = await sessionRow(ctx, sessionId);
  if (!s) return { plan: 'no_session', checksLeft: 0 };
  if (s.expiresAt < now) return { plan: 'expired', checksLeft: 0 };
  const used = s.rbiDay === day ? (s.rbiChecks ?? 0) : 0;
  if (used >= RBI_LIMITS.perSessionPerDay) return { plan: 'limit', checksLeft: 0 };
  const { _id, _creationTime, ...rest } = s;
  await ctx.db.replace(_id, { ...rest, rbiDay: day, rbiChecks: used + 1 });
  const checksLeft = RBI_LIMITS.perSessionPerDay - used - 1;
  const latest = await latestRate(ctx);
  if (latest?.checkedAt && now - latest.checkedAt <= RBI_LIMITS.reuseMs) return { plan: 'cached', checksLeft };
  // Presses that land together share one read: within a minute of a claimed read, others wait for its result.
  const last = await counter(ctx, 'rbi:lastFetch');
  if (last && now - last.count < 60_000) return { plan: 'cached', checksLeft };
  const key = `rbi:${day}`;
  if (((await counter(ctx, key))?.count ?? 0) >= RBI_LIMITS.readsPerDay) return { plan: 'busy', checksLeft };
  await bump(ctx, key);
  if (last) await ctx.db.replace(last._id, { key: 'rbi:lastFetch', count: now }); else await ctx.db.insert('usageCounter', { key: 'rbi:lastFetch', count: now });
  return { plan: 'fetch', checksLeft };
}

export async function storeCheck(ctx: Ctx, row: StoredCheck) {
  if (!(row.value > 0 && row.value <= 25)) throw new Error('Rate refused: outside 0 to 25 percent.');
  if (row.date !== istDate(Date.now())) throw new Error("Rate refused: the date must be today's date in India.");
  if (row.sourceUrl !== RBI_HOME || row.scheduleUrl !== RBI_SCHEDULE) throw new Error('Rate refused: the sources must be the fixed RBI pages.');
  await ctx.db.insert('rbiCheck', { ...row, checkedAt: Date.now() });
}

type Deps = {
  claim: () => Promise<{ plan: Plan; checksLeft: number }>;
  fetchText: (url: string) => Promise<string>;
  store: (row: StoredCheck) => Promise<unknown>;
  latest: () => Promise<Awaited<ReturnType<typeof latestRate>>>;
};

export async function runCheck(d: Deps) {
  const { plan, checksLeft } = await d.claim();
  if (plan !== 'fetch') return { status: plan, checksLeft, rate: await d.latest() };
  try {
    const [home, schedulePage] = await Promise.all([d.fetchText(RBI_HOME), d.fetchText(RBI_SCHEDULE)]);
    const value = parseBankRate(home), schedule = parseMpcSchedule(schedulePage);
    const date = istDate(Date.now());
    const { lastDecision, next } = policyDates(schedule, date);
    await d.store({ value, date, sourceUrl: RBI_HOME, lastDecision, ...(next ? { nextStart: next.start, nextEnd: next.end } : {}), scheduleUrl: RBI_SCHEDULE, scheduleFy: schedule.fy });
    return { status: 'fresh' as const, checksLeft, rate: await d.latest() };
  } catch {
    return { status: 'failed' as const, checksLeft, rate: await d.latest() };
  }
}

// Only the two fixed RBI addresses, no redirects, a time limit and a size limit.
export async function fetchRbi(url: string): Promise<string> {
  if (url !== RBI_HOME && url !== RBI_SCHEDULE) throw new Error('Not an allowed RBI page.');
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0' } });
  if (res.status !== 200) throw new Error(`RBI answered ${res.status}.`);
  const text = await res.text();
  if (text.length > 2_000_000) throw new Error('The RBI page is unexpectedly large.');
  return text;
}
