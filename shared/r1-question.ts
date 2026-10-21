import { formatIndianRupees, type RawFlag } from './flag-input';
import { NATURE_OPTIONS, COUNTERPARTY_OPTIONS, TERM_OPTIONS } from './outcomes';

// R1 question text written by code (Swapnil's wording, 21 Oct 2026). Neutral and open: it states count, total, plain dates and the
// narration, never says loan, advance or deposit, and keeps the answer options on buttons. The AI may word the same question; this is
// the fallback and the baseline the checker is run against.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function plainDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function fixedR1Question(flag: RawFlag): { context: string; question: string; text: string } {
  if (flag.entries.length === 0) throw new Error('A question needs at least one entry.');
  const entries = [...flag.entries].sort((a, b) => a.date.slice(0, 10) < b.date.slice(0, 10) ? -1 : a.date.slice(0, 10) > b.date.slice(0, 10) ? 1 : 0);
  const total = entries.reduce((s, e) => s + e.amountPaise, 0);
  const first = plainDate(entries[0].date), last = plainDate(entries[entries.length - 1].date);
  const when = first === last ? `on ${first}` : `between ${first} and ${last}`;
  const narrations = [...new Set(entries.map(e => e.narration))].slice(0, 2).map(n => `'${n}'`);
  const reads = narrations.length === 1 ? `The narration reads ${narrations[0]}.` : `The narrations read ${narrations[0]} and ${narrations[1]}.`;
  const n = entries.length;
  const context = `The books show ${n} ${n === 1 ? 'receipt' : 'receipts'} from the bank into ${flag.ledgerName}'s account, totalling ${formatIndianRupees(total)}, ${when}. ${reads}`;
  const question = 'What was this money received for?';
  return { context, question, text: `${context} ${question}` };
}

type Button = { value: string; label: string };
const labels = (pairs: [string, string][]): Button[] => pairs.map(([value, label]) => ({ value, label }));
export const R1_NATURE_BUTTONS: Button[] = labels([
  ['goods_services', 'Goods or services supplied'], ['loan', 'Loan'], ['advance', 'Advance against future supply'], ['deposit', 'Security deposit'], ['not_sure', 'Not sure'],
]);
export const R1_FOLLOWUPS: { id: 'counterparty' | 'term' | 'declaration'; question: string; buttons: Button[]; onlyFor?: string[] }[] = [
  { id: 'counterparty', question: 'Who provided the money?', buttons: labels([
    ['director', 'Director'], ['relative', 'Relative of a director'], ['shareholder', 'Shareholder'], ['group_company', 'Group company'], ['other', 'Other'], ['not_sure', 'Not sure']]) },
  { id: 'term', question: 'When is it to be repaid?', buttons: labels([
    ['within_12_months', 'Within 12 months'], ['after_12_months', 'After 12 months'], ['on_demand', 'On demand or no terms']]) },
  { id: 'declaration', question: 'Does the company hold a written declaration from them about the source of this money?', buttons: labels([
    ['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']]), onlyFor: ['director', 'relative'] },
];
// Guard: the button values stay in step with the outcome rules.
for (const [list, values] of [[NATURE_OPTIONS, R1_NATURE_BUTTONS], [COUNTERPARTY_OPTIONS, R1_FOLLOWUPS[0].buttons], [TERM_OPTIONS, R1_FOLLOWUPS[1].buttons]] as const) {
  if (list.join() !== values.map(b => b.value).join()) throw new Error('R1 buttons are out of step with the outcome options.');
}
