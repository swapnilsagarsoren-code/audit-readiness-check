import type { LateBill } from './rules';

// MSMED Act s.16: interest at three times the Bank Rate, compounded with monthly rests, from the appointed day to payment (or year end).
// INDICATIVE: whole 30-day months are compounded at 3 x rate / 12; the leftover days are simple interest at 3 x rate / 365 on the grown
// amount. It uses one Bank Rate (the one stored from the RBI site on a stated date), not the rate history, so the controller confirms the figure.
export function indicativeInterest(i: { principalPaise: number; daysLate: number; bankRatePercent: number }): number {
  const { principalPaise, daysLate, bankRatePercent } = i;
  if (!Number.isSafeInteger(principalPaise) || principalPaise <= 0) throw new Error('Interest needs a whole-paise principal above zero.');
  if (!Number.isSafeInteger(daysLate) || daysLate < 0) throw new Error('Interest needs whole days late, zero or more.');
  if (!(bankRatePercent > 0 && bankRatePercent <= 25)) throw new Error('Interest needs a Bank Rate between 0 and 25 percent.');
  if (daysLate === 0) return 0;
  const annual = 3 * bankRatePercent / 100, months = Math.floor(daysLate / 30), rest = daysLate - months * 30;
  let amount = principalPaise;
  for (let m = 0; m < months; m++) amount += amount * (annual / 12);
  amount += amount * annual * rest / 365;
  return Math.round(amount - principalPaise);
}

export function supplierInterest(bills: LateBill[], bankRatePercent: number): { principal: number; interest: number; bills: (LateBill & { interest: number })[] } {
  const rows = bills.map(b => ({ ...b, interest: indicativeInterest({ principalPaise: b.amount, daysLate: b.daysLate, bankRatePercent }) }));
  return { principal: rows.reduce((s, b) => s + b.amount, 0), interest: rows.reduce((s, b) => s + b.interest, 0), bills: rows };
}
