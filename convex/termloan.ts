import { v } from 'convex/values';
import { query, mutation } from './functions';
import { termLoanAnswerFields } from './schema';
import { loadBooks } from './books';
import { recordAnswer, decideOn, rowFor } from './decisions';
import { evidenceBundle } from '../shared/evidence-bundle';
import { fixedR3Context, r3Snapshot, r3ApprovalBlock, R3_QUESTION, type R3Answer } from '../shared/r3-outcome';

// R3 (term loan, no current-maturity split): question written by code, split computed by code, outcome fixed.
// Reads are public; every write checks the edit passcode first and writes nothing to the books.
const { sessionId: _s, flagKey: _k, answeredAt: _a, ...answerArgs } = termLoanAnswerFields;

async function loadFlag(ctx: { db: any }, flagKey: string) {
  const flag = await ctx.db.query('flag').withIndex('by_key', (q: any) => q.eq('flagKey', flagKey)).unique();
  return flag && flag.ruleId === 'R3' ? flag : null;
}
const toAnswer = (a: { documents?: R3Answer['documents'] }): R3Answer => ({ documents: a.documents });

export const detail = query({ args: { sessionId: v.optional(v.string()), flagKey: v.string() }, handler: async (ctx, { sessionId, flagKey }) => {
  const flag = await loadFlag(ctx, flagKey);
  if (!flag) return null;
  const { data, covenants } = await loadBooks(ctx);
  const answer = await rowFor(ctx, 'termLoanAnswer', sessionId, flagKey);
  const outcome = await rowFor(ctx, 'termLoanOutcome', sessionId, flagKey);
  const { _id, _creationTime, ...a } = answer ?? ({} as Record<string, unknown>);
  return {
    flag: { flagKey, party: flag.party, ledger: flag.ledger, amount: flag.amount, band: flag.band },
    context: fixedR3Context(data, flag.ledger), question: R3_QUESTION, evidence: evidenceBundle('R3'),
    answer: answer ? a : null,
    snapshot: answer ? r3Snapshot(toAnswer(answer), data, flag.ledger, covenants.currentRatio) : null,
    decision: outcome ? { decision: outcome.decision, decidedAt: outcome.decidedAt } : null,
  };
} });

export const record = mutation({ args: { sessionId: v.optional(v.string()), flagKey: v.string(), passcode: v.string(), ...answerArgs }, handler: (ctx, { sessionId, flagKey, passcode, ...fields }) =>
  recordAnswer(ctx, { answerTable: 'termLoanAnswer', outcomeTable: 'termLoanOutcome', sessionId, flagKey, passcode, fields, loadFlag: (key) => loadFlag(ctx, key) }) });

export const decide = mutation({ args: { flagKey: v.string(), passcode: v.string(), answeredAt: v.number(), decision: v.union(v.literal('approved'), v.literal('sent_back')), sessionId: v.optional(v.string()) }, handler: (ctx, { sessionId, flagKey, passcode, answeredAt, decision }) =>
  decideOn(ctx, {
    answerTable: 'termLoanAnswer', outcomeTable: 'termLoanOutcome', sessionId, flagKey, passcode, answeredAt, decision, loadFlag: (key) => loadFlag(ctx, key),
    snapshotFor: async (flag, answer) => { const { data, covenants } = await loadBooks(ctx); return r3Snapshot(toAnswer(answer), data, flag.ledger, covenants.currentRatio); },
    approvalBlock: r3ApprovalBlock,
  }) });
