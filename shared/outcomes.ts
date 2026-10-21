// Fixed R1 outcomes (RULES_v1 R1, Division I). Code decides; the AI never does. Pure functions, integer paise.
export const NATURE_OPTIONS = ['goods_services', 'loan', 'advance', 'deposit', 'not_sure'] as const;
export const COUNTERPARTY_OPTIONS = ['director', 'relative', 'shareholder', 'group_company', 'other', 'not_sure'] as const;
export const TERM_OPTIONS = ['within_12_months', 'after_12_months', 'on_demand'] as const;
export type R1Answer = {
  nature: (typeof NATURE_OPTIONS)[number];
  counterparty?: (typeof COUNTERPARTY_OPTIONS)[number];
  term?: (typeof TERM_OPTIONS)[number];
  declaration?: 'yes' | 'no' | 'unknown'; // written declaration (Deposit Rules), asked for a director or relative only
};
export type ProposedEntry = { debit: string; credit: string; amount: number };
export type R1Outcome = {
  kind: 'no_change' | 'reclass' | 'escalate' | 'ask_more';
  caption?: string; entry?: ProposedEntry; missing?: ('counterparty' | 'term' | 'declaration')[];
  relatedPartyDisclosure: boolean; legalReview: boolean; note: string;
};

const RELATED = ['director', 'relative', 'shareholder', 'group_company'];
const has = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === 'string' && list.includes(v);

export function r1Outcome(answer: R1Answer, flag: { ledger: string; amount: number; related?: boolean }): R1Outcome {
  if (!Number.isSafeInteger(flag.amount) || flag.amount <= 0) throw new Error('Outcome needs a flag amount in whole paise above zero.');
  if (!has(NATURE_OPTIONS, answer.nature)) throw new Error('Unknown answer.');
  if (answer.counterparty !== undefined && !has(COUNTERPARTY_OPTIONS, answer.counterparty)) throw new Error('Unknown answer.');
  if (answer.term !== undefined && !has(TERM_OPTIONS, answer.term)) throw new Error('Unknown answer.');
  const none = { relatedPartyDisclosure: false, legalReview: false };
  if (answer.nature === 'goods_services') return { kind: 'no_change', ...none, note: 'No change. It stays a trade payable.' };
  if (answer.nature !== 'loan') return { kind: 'escalate', ...none, note: 'There is no fixed outcome for this answer yet. It goes to the owner to decide.' };
  const missing: NonNullable<R1Outcome['missing']> = [];
  if (!answer.counterparty) missing.push('counterparty');
  if (!answer.term) missing.push('term');
  if ((answer.counterparty === 'director' || answer.counterparty === 'relative') && !answer.declaration) missing.push('declaration');
  if (missing.length) return { kind: 'ask_more', missing, ...none, note: 'More answers are needed before an outcome can be shown.' };
  if (answer.counterparty === 'not_sure') return { kind: 'escalate', ...none, note: 'The lender is not known. It goes to the owner to decide.' };
  const related = RELATED.includes(answer.counterparty!);
  const horizon = answer.term === 'after_12_months' ? 'Long-term borrowings' : 'Short-term borrowings';
  const caption = `${horizon}: ${related ? 'Loans and advances from related parties' : 'Other loans and advances'}`;
  const declared = answer.declaration === 'yes';
  const legalReview = (answer.counterparty === 'director' || answer.counterparty === 'relative') && !declared;
  return {
    kind: 'reclass', caption, entry: { debit: flag.ledger, credit: caption, amount: flag.amount },
    relatedPartyDisclosure: related, legalReview,
    note: `Move from trade payables to borrowings.${related ? ' Related-party disclosure (AS 18): controller to confirm.' : flag.related ? ' Possible related party: controller to confirm.' : ''}${legalReview ? ' Legal review needed: the written declaration is not confirmed.' : ''}`,
  };
}
