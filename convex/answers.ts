import { v } from 'convex/values';
import { query, mutation } from './functions';
import { answerFields } from './schema';
import { loadBooks } from './books';
import { recordAnswer, decideOn, rowFor } from './decisions';
import { decisionSnapshot, r1ApprovalBlock } from '../shared/decision';
import { fixedR1Question, R1_FOLLOWUPS, R1_NATURE_BUTTONS } from '../shared/r1-question';
import { evidenceBundle } from '../shared/evidence-bundle';
import type { R1Answer } from '../shared/outcomes';
import type { RawFlag } from '../shared/flag-input';

// Gate B: R1 only. Reads are public and plain; every write checks the edit passcode first and records nothing in the books.
const { sessionId: _s, flagKey: _k, answeredAt: _a, ...answerArgs } = answerFields;

async function loadFlag(ctx: { db: any }, flagKey: string) {
  const flag = await ctx.db.query('flag').withIndex('by_key', (q: any) => q.eq('flagKey', flagKey)).unique();
  return flag && flag.ruleId === 'R1' ? flag : null;
}
async function loadEntries(ctx: { db: any }, flag: { entryRefs: { voucher_no: string; ledger: string }[] }) {
  const rows: Record<string, any>[] = [];
  for (const ref of flag.entryRefs) {
    for (const e of await ctx.db.query('entry').withIndex('by_voucher_line', (q: any) => q.eq('voucher_no', ref.voucher_no)).collect()) if (e.ledger === ref.ledger) rows.push(e);
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
const toAnswer = (a: { nature: R1Answer['nature']; counterparty?: R1Answer['counterparty']; term?: R1Answer['term']; declaration?: R1Answer['declaration'] }): R1Answer => ({ nature: a.nature, counterparty: a.counterparty, term: a.term, declaration: a.declaration });

export const detail = query({ args: { sessionId: v.optional(v.string()), flagKey: v.string() }, handler: async (ctx, { sessionId, flagKey }) => {
  const flag = await loadFlag(ctx, flagKey);
  if (!flag) return null;
  const rows = await loadEntries(ctx, flag);
  const raw: RawFlag = { flagKey, ruleId: 'R1', ledgerName: flag.ledger, tallyGroup: (await ctx.db.query('ledger').withIndex('by_name', (q) => q.eq('ledger_name', flag.ledger)).unique())?.tally_group ?? '',
    entries: rows.map((e, i) => ({ date: e.date, party: e.party, narration: e.narration, amountPaise: e.amount, voucherNo: e.voucher_no ?? '', lineNo: e.line_no ?? i + 1 })) };
  const answer = await rowFor(ctx, 'answer', sessionId, flagKey);
  const outcome = await rowFor(ctx, 'outcome', sessionId, flagKey);
  const { _id, _creationTime, ...a } = answer ?? ({} as Record<string, unknown>);
  let snapshot: ReturnType<typeof decisionSnapshot> | null = null;
  if (answer) { const b = await loadBooks(ctx); snapshot = decisionSnapshot(toAnswer(answer), { ledger: flag.ledger, amount: flag.amount, related: flag.related }, b.data.ledgers, b.data.entries as never, b.covenants.debtEquity); }
  return {
    flag: { flagKey, ledger: flag.ledger, party: flag.party, amount: flag.amount, band: flag.band, related: flag.related },
    entries: rows.map((e) => ({ voucher_no: e.voucher_no, date: e.date, amount: e.amount, narration: e.narration })),
    question: fixedR1Question(raw), natureButtons: R1_NATURE_BUTTONS, followups: R1_FOLLOWUPS,
    evidence: evidenceBundle('R1', { isLoan: answer?.nature === 'loan' }),
    answer: answer ? a : null, snapshot,
    decision: outcome ? { decision: outcome.decision, decidedAt: outcome.decidedAt } : null,
  };
} });

export const record = mutation({ args: { sessionId: v.optional(v.string()), flagKey: v.string(), passcode: v.string(), ...answerArgs }, handler: (ctx, { sessionId, flagKey, passcode, ...fields }) =>
  recordAnswer(ctx, { answerTable: 'answer', outcomeTable: 'outcome', sessionId, flagKey, passcode, fields, loadFlag: (key) => loadFlag(ctx, key) }) });

export const decide = mutation({ args: { flagKey: v.string(), passcode: v.string(), answeredAt: v.number(), decision: v.union(v.literal('approved'), v.literal('sent_back')), sessionId: v.optional(v.string()) }, handler: (ctx, { sessionId, flagKey, passcode, answeredAt, decision }) =>
  decideOn(ctx, {
    answerTable: 'answer', outcomeTable: 'outcome', sessionId, flagKey, passcode, answeredAt, decision, loadFlag: (key) => loadFlag(ctx, key),
    snapshotFor: async (flag, answer) => { const b = await loadBooks(ctx); return decisionSnapshot(toAnswer(answer), { ledger: flag.ledger, amount: flag.amount, related: flag.related }, b.data.ledgers, b.data.entries as never, b.covenants.debtEquity); },
    approvalBlock: r1ApprovalBlock,
  }) });
