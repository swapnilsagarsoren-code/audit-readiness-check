import { v } from 'convex/values';
import { query, mutation } from './functions';
import { msmeAnswerFields } from './schema';
import { loadBooks } from './books';
import { latestRate } from './rbiCore';
import { recordAnswer, decideOn, rowFor } from './decisions';
import { evidenceBundle } from '../shared/evidence-bundle';
import { fixedR2Context, r2Snapshot, r2ApprovalBlock, R2_FOLLOWUPS, type R2Answer } from '../shared/r2-outcome';
import { msmeLateBills } from '../shared/rules';

// R2 (MSME supplier paid late): the question is written by code, the outcome is fixed, and interest uses the stored RBI Bank Rate.
// Reads are public; every write checks the edit passcode first and writes nothing to the books.
const { sessionId: _s, flagKey: _k, answeredAt: _a, ...answerArgs } = msmeAnswerFields;

async function loadFlag(ctx: { db: any }, flagKey: string) {
  const flag = await ctx.db.query('flag').withIndex('by_key', (q: any) => q.eq('flagKey', flagKey)).unique();
  return flag && flag.ruleId === 'R2' ? flag : null;
}
const currentRate = async (ctx: { db: any }) => { const r = await latestRate(ctx); return r ? { value: r.value, date: r.date, sourceUrl: r.sourceUrl } : null; };
const toAnswer = (a: { certificate?: R2Answer['certificate']; size?: R2Answer['size']; terms?: R2Answer['terms'] }): R2Answer => ({ certificate: a.certificate, size: a.size, terms: a.terms });

export const detail = query({ args: { sessionId: v.optional(v.string()), flagKey: v.string() }, handler: async (ctx, { sessionId, flagKey }) => {
  const flag = await loadFlag(ctx, flagKey);
  if (!flag) return null;
  const { data } = (await loadBooks(ctx));
  const rate = await currentRate(ctx);
  const supplier = data.suppliers.find(s => s.supplier === flag.ledger);
  if (!supplier) return null;
  const master = msmeLateBills(data, supplier);
  const answer = await rowFor(ctx, 'msmeAnswer', sessionId, flagKey);
  const outcome = await rowFor(ctx, 'msmeOutcome', sessionId, flagKey);
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

export const record = mutation({ args: { sessionId: v.optional(v.string()), flagKey: v.string(), passcode: v.string(), ...answerArgs }, handler: (ctx, { sessionId, flagKey, passcode, ...fields }) =>
  recordAnswer(ctx, { answerTable: 'msmeAnswer', outcomeTable: 'msmeOutcome', sessionId, flagKey, passcode, fields, loadFlag: (key) => loadFlag(ctx, key) }) });

export const decide = mutation({ args: { flagKey: v.string(), passcode: v.string(), answeredAt: v.number(), decision: v.union(v.literal('approved'), v.literal('sent_back')), sessionId: v.optional(v.string()) }, handler: (ctx, { sessionId, flagKey, passcode, answeredAt, decision }) =>
  decideOn(ctx, {
    answerTable: 'msmeAnswer', outcomeTable: 'msmeOutcome', sessionId, flagKey, passcode, answeredAt, decision, loadFlag: (key) => loadFlag(ctx, key),
    snapshotFor: async (flag, answer) => { const { data } = await loadBooks(ctx); return r2Snapshot(toAnswer(answer), data, flag.ledger, await currentRate(ctx)); },
    approvalBlock: r2ApprovalBlock,
  }) });
