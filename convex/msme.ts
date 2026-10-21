import { v } from 'convex/values';
import { query, mutation } from './functions';
import { msmeAnswerFields } from './schema';
import { loadBooks } from './books';
import { recordAnswer, decideOn } from './decisions';
import { evidenceBundle } from '../shared/evidence-bundle';
import { fixedR2Context, r2Snapshot, r2ApprovalBlock, R2_FOLLOWUPS, type R2Answer } from '../shared/r2-outcome';
import { msmeLateBills } from '../shared/rules';

// R2 (MSME supplier paid late): the question is written by code, the outcome is fixed, and interest uses the stored RBI Bank Rate.
// Reads are public; every write checks the edit passcode first and writes nothing to the books.
const { flagKey: _k, answeredAt: _a, ...answerArgs } = msmeAnswerFields;

async function loadFlag(ctx: { db: any }, flagKey: string) {
  const flag = await ctx.db.query('flag').withIndex('by_key', (q: any) => q.eq('flagKey', flagKey)).unique();
  return flag && flag.ruleId === 'R2' ? flag : null;
}
async function currentRate(ctx: { db: any }): Promise<{ value: number; date: string; sourceUrl: string } | null> {
  const rates = (await ctx.db.query('rbiBankRate').collect()).filter((r: any) => r.value !== null && r.date !== null).sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rates[0] ? { value: rates[0].value as number, date: rates[0].date as string, sourceUrl: rates[0].sourceUrl as string } : null;
}
const toAnswer = (a: { certificate?: R2Answer['certificate']; size?: R2Answer['size']; terms?: R2Answer['terms'] }): R2Answer => ({ certificate: a.certificate, size: a.size, terms: a.terms });

export const detail = query({ args: { flagKey: v.string() }, handler: async (ctx, { flagKey }) => {
  const flag = await loadFlag(ctx, flagKey);
  if (!flag) return null;
  const { data } = (await loadBooks(ctx));
  const rate = await currentRate(ctx);
  const supplier = data.suppliers.find(s => s.supplier === flag.ledger);
  if (!supplier) return null;
  const master = msmeLateBills(data, supplier);
  const answer = await ctx.db.query('msmeAnswer').withIndex('by_flag', (q) => q.eq('flagKey', flagKey)).unique();
  const outcome = await ctx.db.query('msmeOutcome').withIndex('by_flag', (q) => q.eq('flagKey', flagKey)).unique();
  const { _id, _creationTime, ...a } = answer ?? ({} as Record<string, unknown>);
  return {
    flag: { flagKey, party: flag.party, amount: flag.amount, band: flag.band, statusKnown: flag.statusKnown },
    supplier: { status: supplier.msme_status, writtenDays: supplier.written_credit_days },
    bills: master.bills, allowed: master.allowed,
    context: fixedR2Context(data, flag.ledger), followups: R2_FOLLOWUPS(flag.party), evidence: evidenceBundle('R2'),
    answer: answer ? a : null,
    snapshot: answer ? r2Snapshot(toAnswer(answer), data, flag.ledger, rate) : null,
    decision: outcome ? { decision: outcome.decision, decidedAt: outcome.decidedAt } : null,
  };
} });

export const record = mutation({ args: { flagKey: v.string(), passcode: v.string(), ...answerArgs }, handler: (ctx, { flagKey, passcode, ...fields }) =>
  recordAnswer(ctx, { answerTable: 'msmeAnswer', outcomeTable: 'msmeOutcome', flagKey, passcode, fields, loadFlag: (key) => loadFlag(ctx, key) }) });

export const decide = mutation({ args: { flagKey: v.string(), passcode: v.string(), answeredAt: v.number(), decision: v.union(v.literal('approved'), v.literal('sent_back')) }, handler: (ctx, { flagKey, passcode, answeredAt, decision }) =>
  decideOn(ctx, {
    answerTable: 'msmeAnswer', outcomeTable: 'msmeOutcome', flagKey, passcode, answeredAt, decision, loadFlag: (key) => loadFlag(ctx, key),
    snapshotFor: async (flag, answer) => { const { data } = await loadBooks(ctx); return r2Snapshot(toAnswer(answer), data, flag.ledger, await currentRate(ctx)); },
    approvalBlock: r2ApprovalBlock,
  }) });
