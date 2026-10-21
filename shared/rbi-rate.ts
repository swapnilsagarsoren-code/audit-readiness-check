// Reads the Bank Rate from the "Current Rates / Policy Rates" block on rbi.org.in. Never typed in (RULES_v1 R2).
// Defence against a changed page: the Bank Rate must appear once, and RBI keeps it equal to the Marginal Standing Facility rate, so both must match.
function rateAfter(html: string, label: string): number[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  return [...text.matchAll(new RegExp(`${label}\\s*:\\s*(\\d{1,2}(?:\\.\\d{1,3})?)\\s*%`, 'g'))].map(m => Number(m[1]));
}
export function parseBankRate(html: string): number {
  const bank = rateAfter(html, 'Bank Rate'), msf = rateAfter(html, 'Marginal Standing Facility Rate');
  if (bank.length !== 1 || msf.length !== 1) throw new Error('The RBI page did not show exactly one Bank Rate and one Marginal Standing Facility rate.');
  if (bank[0] !== msf[0]) throw new Error('The Bank Rate and the Marginal Standing Facility rate differ, so the page layout may have changed.');
  if (!(bank[0] > 0 && bank[0] <= 25)) throw new Error('The Bank Rate is outside 0 to 25 percent.');
  return bank[0];
}

// The stored rate date must be today's date in India, so a mistyped future date can never win as "latest".
export function istDate(now: number): string {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}
