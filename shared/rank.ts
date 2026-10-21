import type { Materiality } from './materiality';
import type { RuleFlag } from './rules';

export type Band = 'flagged' | 'below';
export type RankedFlag = RuleFlag & { band: Band; percentOfFlagLine: number };

// At or above the flag line: flagged. From the hide line up to the flag line: shown muted as "below".
// Under the hide line: dropped. Largest amount first; ties by rule, then party, so the order never shifts.
export function rankFlags(flags: RuleFlag[], m: Materiality): RankedFlag[] {
  if (m.flagLine <= 0) throw new Error('Ranking needs a flag line above zero.');
  return flags
    .filter(f => f.amount >= m.hideBelow)
    .map(f => ({ ...f, band: (f.amount >= m.flagLine ? 'flagged' : 'below') as Band, percentOfFlagLine: Math.floor(f.amount * 100 / m.flagLine) }))
    .sort((a, b) => b.amount - a.amount || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0) || (a.party < b.party ? -1 : a.party > b.party ? 1 : 0));
}
