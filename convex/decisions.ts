import { guard } from './guard';

// The save and approve steps shared by R1, R2 and R3. Order is fixed here once: passcode first, then the flag, then the writes.
// Nothing here touches the books. Refusals are returned, never thrown, so the failure log from guard() is kept.
type Ctx = { db: any };
type Tables = { answerTable: string; outcomeTable: string };
const refused = (reason: string) => ({ ok: false as const, reason });
const byFlag = (ctx: Ctx, table: string, flagKey: string) => ctx.db.query(table).withIndex('by_flag', (q: any) => q.eq('flagKey', flagKey)).unique();

export async function recordAnswer(ctx: Ctx, o: Tables & { flagKey: string; passcode: string; fields: Record<string, unknown>; loadFlag: (flagKey: string) => Promise<unknown | null> }) {
  const g = await guard(ctx, o.passcode);
  if (g.result !== 'ok') return refused(g.result);
  if (!(await o.loadFlag(o.flagKey))) return refused('unknown_flag');
  const old = await byFlag(ctx, o.answerTable, o.flagKey);
  const row = { flagKey: o.flagKey, ...o.fields, answeredAt: Date.now() };
  if (old) await ctx.db.replace(old._id, row); else await ctx.db.insert(o.answerTable, row);
  // A new answer clears any earlier decision: the controller must decide again on what is now on screen.
  const prior = await byFlag(ctx, o.outcomeTable, o.flagKey);
  if (prior) await ctx.db.delete(prior._id);
  return { ok: true as const };
}

export async function decideOn<S>(ctx: Ctx, o: Tables & {
  flagKey: string; passcode: string; answeredAt: number; decision: 'approved' | 'sent_back';
  loadFlag: (flagKey: string) => Promise<any | null>;
  snapshotFor: (flag: any, answer: any) => Promise<S> | S;
  approvalBlock: (snapshot: S) => string | null;
}) {
  const g = await guard(ctx, o.passcode);
  if (g.result !== 'ok') return refused(g.result);
  const flag = await o.loadFlag(o.flagKey);
  if (!flag) return refused('unknown_flag');
  const answer = await byFlag(ctx, o.answerTable, o.flagKey);
  if (!answer) return refused('no_answer');
  if (answer.answeredAt !== o.answeredAt) return refused('stale'); // the controller must decide on the answer they were shown
  const snapshot = await o.snapshotFor(flag, answer);
  const block = o.decision === 'approved' ? o.approvalBlock(snapshot) : null;
  if (block) return refused(block);
  const row = { flagKey: o.flagKey, decision: o.decision, decidedAt: Date.now(), snapshot: JSON.parse(JSON.stringify(snapshot)) };
  const old = await byFlag(ctx, o.outcomeTable, o.flagKey);
  if (old) await ctx.db.replace(old._id, row); else await ctx.db.insert(o.outcomeTable, row);
  return { ok: true as const };
}
