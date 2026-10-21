import { formatIndianRupees, rupeesAndPaise } from './flag-input';
import { plainDate } from './r1-question';
import type { DecisionSnapshot } from './decision';
import type { R2Snapshot } from './r2-outcome';
import type { R3Snapshot } from './r3-outcome';

// Story mode (DESIGN.md section 11): three fixed cases from the dev demo, wrapped in a short mission. Words are Swapnil's.
export type RuleId = 'R1' | 'R2' | 'R3';
export const STORY_CASES = [
  { flagKey: 'R1:Rajesh Mehta', ruleId: 'R1', title: 'Whose money is this?', answerTable: 'answer', outcomeTable: 'outcome' },
  { flagKey: 'R2:Delta Rubber', ruleId: 'R2', title: 'Did we pay a small supplier late?', answerTable: 'msmeAnswer', outcomeTable: 'msmeOutcome' },
  { flagKey: 'R3:Meridian Co-operative Bank Term Loan', ruleId: 'R3', title: 'How much of this loan is due this year?', answerTable: 'termLoanAnswer', outcomeTable: 'termLoanOutcome' },
] as const satisfies readonly { flagKey: string; ruleId: RuleId; title: string; answerTable: string; outcomeTable: string }[];

export type NextStep = { kind: 'case'; flagKey: string; title: string } | { kind: 'board' };
export function nextStep(flagKey: string): NextStep {
  const i = STORY_CASES.findIndex(c => c.flagKey === flagKey), n = i < 0 ? undefined : STORY_CASES[i + 1];
  return n ? { kind: 'case', flagKey: n.flagKey, title: n.title } : { kind: 'board' };
}

export type CaseStatus = 'open' | 'answered' | 'approved' | 'sent_back';
export const STATUS_WORDS: Record<CaseStatus, string> = { open: 'Open', answered: 'Answered', approved: 'Approved', sent_back: 'Sent back' };
export const isDecided = (s: CaseStatus) => s === 'approved' || s === 'sent_back';

export type CaseLine = { entry: string | null; effect: string | null };
export type StoryCard = { flagKey: string; ruleId: RuleId; title: string; party: string | null; amount: number | null; status: CaseStatus; decidedAt: number | null; line: CaseLine | null };
export type StoryBoard = {
  session: { exists: boolean; expired: boolean };
  cases: StoryCard[];
  meters: { debtEquity: { booked: number; now: number; limit: number }; currentRatio: { booked: number; now: number; floor: number } };
};

// The company's year-end figures as booked. Amounts are integer paise; ratios and days are plain numbers.
export type CompanyFigures = {
  profitAndLoss: { revenue: number; materials: number; directCosts: number; otherExpenses: number; otherIncome: number; pbt: number };
  balanceSheet: { fixedAssets: number; inventory: number; receivables: number; cashAndBank: number; equity: number; borrowings: number; tradePayables: number };
  ratios: { profitMargin: number; debtEquity: number; debtEquityCap: number; currentRatio: number; currentFloor: number; receivableDays: number; inventoryDays: number; payableDays: number };
  audit: { materiality: number; flagLine: number };
};

const verdict = (v: 'within' | 'breach' | undefined) => (v === 'breach' ? 'breaks' : 'holds');
type Snapshots = { R1: DecisionSnapshot; R2: R2Snapshot; R3: R3Snapshot };

// One plain sentence for the entry and one for the covenant, from the snapshot the server stored on approval.
export function caseLine<R extends RuleId>(ruleId: R, snapshot: Snapshots[R]): CaseLine {
  if (ruleId === 'R1') {
    const s = snapshot as DecisionSnapshot;
    if (s.outcome.kind !== 'reclass' || !s.outcome.entry || !s.after) return { entry: null, effect: s.outcome.note };
    return {
      entry: `Move ${formatIndianRupees(s.outcome.entry.amount)} from trade payables to ${s.outcome.entry.credit.split(':')[0].toLowerCase()}.`,
      effect: `Debt-equity ${s.before.ratio.toFixed(2)} → ${s.after.ratio.toFixed(2)} against the ${s.covenantMax.toFixed(2)} limit: ${verdict(s.covenantAfter)}`,
    };
  }
  if (ruleId === 'R2') {
    const s = snapshot as R2Snapshot;
    if (s.kind !== 'interest_due') return { entry: null, effect: s.notes[0] ?? null };
    return { entry: typeof s.interest === 'number' ? `Indicative MSMED interest of ${rupeesAndPaise(s.interest)}.` : 'Interest not priced yet.', effect: 'No covenant effect' };
  }
  const s = snapshot as R3Snapshot;
  if ((s.kind !== 'split' && s.kind !== 'estimate') || !s.split || !s.currentBefore || !s.currentAfter || s.covenantMin === undefined) return { entry: null, effect: s.notes[0] ?? null };
  return {
    entry: `Move ${formatIndianRupees(s.split.due12)} due within 12 months to current liabilities.`,
    effect: `Current ratio ${s.currentBefore.ratio.toFixed(2)} → ${s.currentAfter.ratio.toFixed(2)} against the ${s.covenantMin.toFixed(2)} floor: ${verdict(s.covenantAfter)}`,
  };
}

// The RBI rate block. Times are India time, written without locale formatting so server and browser agree.
export type StoryRate = { value: number; date: string; sourceUrl: string; checkedAt: number | null; lastDecision: string | null; next: { start: string; end: string } | null; scheduleFy?: string | null } | null;
export type RbiStatus = 'fresh' | 'cached' | 'limit' | 'busy' | 'failed' | 'no_session' | 'expired';
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${SHORT[m - 1]} ${y}`; };
const ist = (ms: number) => new Date(ms + 330 * 60_000).toISOString();
const istTime = (ms: number) => { const [h, m] = ist(ms).slice(11, 16).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

export function rbiLine(rate: StoryRate): string {
  if (!rate) return 'No Bank Rate has been stored yet.';
  const checked = rate.checkedAt === null ? shortDate(rate.date) : `${shortDate(ist(rate.checkedAt))}, ${istTime(rate.checkedAt)} IST`;
  const next = rate.next ? `Next scheduled change: ${plainDate(rate.next.end)}` : rate.scheduleFy ? `No further meeting in RBI's ${rate.scheduleFy} schedule` : 'No meeting schedule on file';
  return `Last checked ${checked} · Bank Rate ${rate.value}% · ${next}`;
}

export function rbiMessage(status: RbiStatus, rate: StoryRate): string {
  if (status === 'fresh') return 'Updated from rbi.org.in.';
  if (status === 'cached') return rate?.checkedAt ? `Already up to date (checked ${istTime(rate.checkedAt)})` : 'Already up to date';
  if (status === 'limit') return "You've checked 3 times today. The rate can only change at an RBI decision.";
  if (status === 'busy') return "The demo has reached today's limit. Try again tomorrow.";
  if (status === 'failed') return rate ? `Couldn't read RBI's site. Showing the rate from ${shortDate(rate.date)}.` : "Couldn't read RBI's site.";
  return 'This session has ended. Start a new one.';
}
