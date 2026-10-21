import { formatIndianRupees } from '../shared/flag-input.ts';

export type GapFlag = {
  flagKey: string; ruleId: 'R1' | 'R2' | 'R3'; party: string; ledger: string; amount: number; band: 'flagged' | 'below';
  percentOfFlagLine: number; related: boolean; statusKnown: boolean; note: string;
  entryRefs: { voucher_no: string; ledger: string }[]; ruleVersion: string; rank: number;
};
export type GapsData = { materiality: { overall: number; flagLine: number; hideBelow: number; basis: 'revenue' | 'pbt' }; flags: GapFlag[] };
export type GapsState = { status: 'loading' | 'error' | 'empty' } | { status: 'ready'; data: GapsData };

export function formatCroreLakh(paise: number, crore = 'cr'): string {
  const rupees = paise / 100;
  const trim = (n: number) => parseFloat(n.toFixed(2)).toString();
  if (rupees >= 1_00_00_000) return `₹${trim(rupees / 1_00_00_000)} ${crore}`;
  if (rupees >= 1_00_000) return `₹${trim(rupees / 1_00_000)} lakh`;
  return formatIndianRupees(paise);
}

export function isGapsData(value: unknown): value is GapsData {
  const v = value as GapsData | null;
  return !!v && typeof v === 'object' && !!v.materiality && Number.isSafeInteger(v.materiality.flagLine) && Array.isArray(v.flags)
    && v.flags.every(f => f && typeof f.party === 'string' && Number.isSafeInteger(f.amount) && (f.band === 'flagged' || f.band === 'below') && ['R1', 'R2', 'R3'].includes(f.ruleId) && Number.isSafeInteger(f.percentOfFlagLine));
}

