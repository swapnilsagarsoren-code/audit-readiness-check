import { formatIndianRupees } from './flag-input';
import { plainDate } from './r1-question';
import { supplierInterest } from './msme-interest';
import { msmeLateBills, type LateBill, type RuleData } from './rules';

// R2 (MSME supplier paid late): questions written by code, fixed outcomes from RULES_v1 R2. Interest is indicative and uses the stored RBI Bank Rate.
export const CERTIFICATE_OPTIONS = ['yes', 'no', 'not_registered', 'not_sure'] as const;
export const SIZE_OPTIONS = ['micro', 'small', 'medium', 'not_registered', 'not_sure'] as const;
export const TERMS_OPTIONS = ['none', 'up_to_15', 'up_to_30', 'up_to_45', 'over_45'] as const;
export type R2Answer = { certificate?: (typeof CERTIFICATE_OPTIONS)[number]; size?: (typeof SIZE_OPTIONS)[number]; terms?: (typeof TERMS_OPTIONS)[number] };
export type BankRate = { value: number; date: string; sourceUrl: string };
export type R2Snapshot = {
  kind: 'interest_due' | 'not_late' | 'no_interest' | 'escalate' | 'ask_more';
  allowed?: number; principal?: number; interest?: number | null; bankRate: BankRate | null;
  bills: (LateBill & { interest: number | null })[]; notes: string[]; missing?: ('certificate' | 'size' | 'terms')[];
};
const ALLOWED_DAYS = { none: 15, up_to_15: 15, up_to_30: 30, up_to_45: 45, over_45: 45 } as const;
const has = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === 'string' && (list as readonly string[]).includes(v);

const button = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
export function R2_FOLLOWUPS(party: string) {
  return [
    { id: 'certificate' as const, question: `Is the Udyam registration certificate for ${party} on file?`, buttons: button([['yes', 'Yes, on file'], ['no', 'No, not on file'], ['not_registered', 'No, the supplier is not registered'], ['not_sure', 'Not sure']]) },
    { id: 'size' as const, question: 'What size does it show?', onlyWhen: { certificate: 'yes' }, buttons: button([['micro', 'Micro'], ['small', 'Small'], ['medium', 'Medium'], ['not_registered', 'Not registered'], ['not_sure', 'Not sure']]) },
    { id: 'terms' as const, question: 'Are the credit terms in writing?', buttons: button([['none', 'None in writing'], ['up_to_15', 'Up to 15 days'], ['up_to_30', 'Up to 30 days'], ['up_to_45', 'Up to 45 days'], ['over_45', 'More than 45 days']]) },
  ];
}

function supplierOf(data: RuleData, name: string) {
  const s = data.suppliers.find(x => x.supplier === name);
  if (!s) throw new Error('Unknown supplier.');
  return s;
}
const dayNumber = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86_400_000; };

// The facts the controller needs before answering: the bills, days taken, and what the supplier master records. No advice, no money beyond the bills.
export function fixedR2Context(data: RuleData, name: string): string {
  const s = supplierOf(data, name);
  const { bills } = msmeLateBills(data, s);
  const yearEnd = data.company.end.slice(0, 10);
  const n = bills.length, total = bills.reduce((t, b) => t + b.amount, 0);
  const lines = bills.slice(0, 3).map(b => {
    const days = dayNumber(b.paidDate ?? yearEnd) - dayNumber(b.billDate);
    return b.paidDate ? `The bill dated ${plainDate(b.billDate)} was paid on ${plainDate(b.paidDate)}, ${days} days after the bill date.` : `The bill dated ${plainDate(b.billDate)} was not paid by ${plainDate(yearEnd)}, ${days} days after the bill date.`;
  });
  if (n > 3) lines.push(`${n - 3} more ${n - 3 === 1 ? 'bill is' : 'bills are'} also late.`);
  const size = s.msme_status ? `the size as ${s.msme_status}` : 'no size';
  const terms = s.written_credit_days ? `written credit terms of ${s.written_credit_days} days` : 'no written credit terms';
  return `The books show ${n} ${n === 1 ? 'bill' : 'bills'} from ${name}, totalling ${formatIndianRupees(total)}. ${lines.join(' ')} The supplier master records ${size} and ${terms}.`;
}

export function r2Snapshot(answer: R2Answer, data: RuleData, supplierName: string, rate: BankRate | null): R2Snapshot {
  const s = supplierOf(data, supplierName);
  if (answer.certificate !== undefined && !has(CERTIFICATE_OPTIONS, answer.certificate)) throw new Error('Unknown answer.');
  if (answer.size !== undefined && !has(SIZE_OPTIONS, answer.size)) throw new Error('Unknown answer.');
  if (answer.terms !== undefined && !has(TERMS_OPTIONS, answer.terms)) throw new Error('Unknown answer.');
  const base = { bankRate: rate, bills: [] as R2Snapshot['bills'] };
  const missing: NonNullable<R2Snapshot['missing']> = [];
  if (!answer.certificate) missing.push('certificate');
  if (answer.certificate === 'yes' && !answer.size) missing.push('size');
  if (!answer.terms) missing.push('terms');
  if (missing.length) return { kind: 'ask_more', ...base, missing, notes: ['More answers are needed before an outcome can be shown.'] };
  if (answer.certificate === 'not_registered') return { kind: 'no_interest', ...base, notes: ['No MSMED interest if the supplier is not registered, as the protection covers micro and small suppliers only; controller to confirm.'] };
  if (answer.certificate !== 'yes' || answer.size === 'not_sure') return { kind: 'escalate', ...base, notes: ['The size is not confirmed. Ask for the Udyam certificate before any interest is worked out.'] };
  if (answer.size === 'medium' || answer.size === 'not_registered') return { kind: 'no_interest', ...base, notes: ['No MSMED interest if the supplier is medium or not registered, as the protection covers micro and small suppliers only; controller to confirm.'] };
  const allowed = ALLOWED_DAYS[answer.terms!];
  const { bills } = msmeLateBills(data, s, allowed);
  if (bills.length === 0) return { kind: 'not_late', ...base, allowed, principal: 0, interest: 0, notes: [`No bill is late on these terms (${allowed} days from the bill date); controller to confirm the terms.`] };
  const priced = rate ? supplierInterest(bills, rate.value) : null;
  const rows = priced ? priced.bills : bills.map(b => ({ ...b, interest: null as number | null }));
  const notes = [
    'Interest accrues on each late bill (MSMED Act s.16); controller to confirm the dates and the rate.',
    'Disclose the unpaid principal and the interest in the MSME note under trade payables (Schedule III Division I).',
    'The interest is not deductible for tax (s.23), and the expense is deductible only when paid (Income-tax Act s.43B(h)); controller to confirm.',
    rate ? `This screen does not record an agreed interest rate, so the rate under MSMED Act s.16 is applied: three times the RBI Bank Rate (${rate.value}%, as listed on ${new URL(rate.sourceUrl).hostname.replace(/^www\./, '')} on ${plainDate(rate.date)}). Indicative: monthly rests, current rate only, controller to confirm.` : 'Not priced yet: no Bank Rate has been stored from the RBI site.',
  ];
  return { kind: 'interest_due', ...base, allowed, principal: bills.reduce((t, b) => t + b.amount, 0), interest: priced ? priced.interest : null, bills: rows, notes };
}

// Not approvable: unanswered, escalated, or interest due with no stored Bank Rate to price it.
export const r2ApprovalBlock = (s: R2Snapshot): string | null =>
  s.kind === 'ask_more' || s.kind === 'escalate' ? 'answer_incomplete' : s.kind === 'interest_due' && s.interest === null ? 'not_priced' : null;
