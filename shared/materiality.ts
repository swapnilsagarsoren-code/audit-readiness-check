export type MaterialityInputs = { revenueBasisPoints: number; pbtBasisPoints: number; flagBasisPoints: number; trivialBasisPoints: number };
export type Materiality = { overall: number; flagLine: number; hideBelow: number; basis: 'revenue' | 'pbt' };
// All amounts are integer paise. Basis points are parts per 10,000.
const part = (amount: number, bp: number) => Math.floor(amount * bp / 10_000);
export function materiality(figures: { revenue: number; pbt: number }, inputs: MaterialityInputs): Materiality {
  const { revenue, pbt } = figures;
  if (!Number.isSafeInteger(revenue) || !Number.isSafeInteger(pbt)) throw new Error('Materiality needs whole-paise figures.');
  if (revenue <= 0 || pbt <= 0) throw new Error('Materiality needs positive revenue and profit before tax.');
  for (const bp of Object.values(inputs)) if (!Number.isSafeInteger(bp) || bp <= 0 || bp > 10_000) throw new Error('Materiality inputs must be basis points from 1 to 10000.');
  if (inputs.trivialBasisPoints > inputs.flagBasisPoints) throw new Error('Materiality inputs: the hide line cannot be above the flag line.');
  if (revenue * inputs.revenueBasisPoints > Number.MAX_SAFE_INTEGER || pbt * inputs.pbtBasisPoints > Number.MAX_SAFE_INTEGER) throw new Error('Materiality figures are too large for whole-paise arithmetic.');
  const byRevenue = part(revenue, inputs.revenueBasisPoints), byPbt = part(pbt, inputs.pbtBasisPoints);
  const basis = byRevenue < byPbt ? 'revenue' : 'pbt';
  const overall = Math.min(byRevenue, byPbt);
  return { overall, flagLine: part(overall, inputs.flagBasisPoints), hideBelow: part(overall, inputs.trivialBasisPoints), basis };
}
