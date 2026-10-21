import { rowFor } from './decisions';
import { sessionRow } from './visitorCore';
import type { Books } from './books';
import { trialBalance } from '../shared/accounting';
import { materiality } from '../shared/materiality';
import { currentRatio, debtEquity } from '../shared/ratios';
import { caseLine, STORY_CASES, type CaseStatus, type CompanyFigures, type StoryBoard } from '../shared/story';

// The case board for one visitor: only this session's answers and decisions count. The meters move only on an approved
// decision, and only to the figure the server stored with it.
type Ctx = { db: any };
export async function storyBoard(ctx: Ctx, sessionId: string, books: Books): Promise<StoryBoard> {
  const s = await sessionRow(ctx, sessionId);
  const approved: Record<string, any> = {};
  const cases = [];
  for (const c of STORY_CASES) {
    const flag = await ctx.db.query('flag').withIndex('by_key', (q: any) => q.eq('flagKey', c.flagKey)).unique();
    const answer = await rowFor(ctx, c.answerTable, sessionId, c.flagKey);
    const outcome = await rowFor(ctx, c.outcomeTable, sessionId, c.flagKey);
    const status: CaseStatus = outcome ? outcome.decision : answer ? 'answered' : 'open';
    if (status === 'approved') approved[c.ruleId] = outcome.snapshot;
    cases.push({
      flagKey: c.flagKey, ruleId: c.ruleId, title: c.title, party: flag?.party ?? null, amount: flag?.amount ?? null, status,
      decidedAt: outcome?.decidedAt ?? null, line: status === 'approved' ? caseLine(c.ruleId, outcome.snapshot) : null,
    });
  }
  const { ledgers, entries } = books.data;
  const de = debtEquity(ledgers, entries as never).ratio, base = currentRatio(ledgers, entries as never), cr = base.ratio;
  // Both decisions can move current liabilities: a long-term R1 loan leaves them, the R3 split joins them. Work them out together.
  const r1 = approved.R1, r3 = approved.R3, floor = books.covenants.currentRatio;
  const r1Long = r1?.outcome?.kind === 'reclass' && /^Long-term/.test(r1.outcome.entry?.credit ?? '') ? r1.outcome.entry.amount : 0;
  const r3Due = r3?.currentAfter && r3.split ? r3.split.due12 : 0;
  const afterR1 = base.assets / (base.liabilities - r1Long), crNow = base.assets / (base.liabilities - r1Long + r3Due);
  const holds = (x: number) => (x >= floor ? 'holds' : 'breaks');
  for (const c of cases) {
    if (c.ruleId === 'R1' && r1Long && c.line?.effect) c.line = { ...c.line, effect: `${c.line.effect}; current ratio ${cr.toFixed(2)} → ${afterR1.toFixed(2)} against the ${floor.toFixed(2)} floor: ${holds(afterR1)}` };
    if (c.ruleId === 'R3' && r1Long && r3Due && c.line) c.line = { ...c.line, effect: `Current ratio ${afterR1.toFixed(2)} → ${crNow.toFixed(2)} against the ${floor.toFixed(2)} floor: ${holds(crNow)}` };
  }
  return {
    session: { exists: !!s, expired: !!s && s.expiresAt < Date.now() },
    cases,
    meters: {
      debtEquity: { booked: de, now: approved.R1?.after?.ratio ?? de, limit: books.covenants.debtEquity },
      currentRatio: { booked: cr, now: crNow, floor },
    },
  };
}

// The company dashboard: the trial balance as booked, summed by Tally group. Debit balances are positive.
export function companyFigures(books: Books): CompanyFigures {
  const { ledgers, entries, company } = books.data;
  const tb = trialBalance(ledgers, entries as never);
  const sums = new Map<string, number>();
  for (const l of ledgers) sums.set(l.tally_group, (sums.get(l.tally_group) ?? 0) + tb.balances.get(l.ledger_name)!);
  const g = (group: string) => sums.get(group) ?? 0;
  const de = debtEquity(ledgers, entries as never), cr = currentRatio(ledgers, entries as never);
  const m = materiality({ revenue: tb.revenue, pbt: tb.pbt }, company.materialityInputs);
  const materials = g('Purchase Accounts'), receivables = g('Sundry Debtors'), inventory = g('Stock-in-Hand'), tradePayables = -g('Sundry Creditors');
  return {
    profitAndLoss: { revenue: tb.revenue, materials, directCosts: g('Direct Expenses'), otherExpenses: g('Indirect Expenses'), otherIncome: -g('Indirect Incomes'), pbt: tb.pbt },
    balanceSheet: { fixedAssets: g('Fixed Assets'), inventory, receivables, cashAndBank: g('Bank Accounts') + g('Cash-in-Hand'), equity: de.equity, borrowings: de.debt, tradePayables },
    ratios: {
      profitMargin: tb.pbt / tb.revenue, debtEquity: de.ratio, debtEquityCap: books.covenants.debtEquity, currentRatio: cr.ratio, currentFloor: books.covenants.currentRatio,
      receivableDays: receivables / tb.revenue * 365, inventoryDays: inventory / materials * 365, payableDays: tradePayables / materials * 365,
    },
    audit: { materiality: m.overall, flagLine: m.flagLine },
  };
}
