import { trialBalance } from './accounting';
import { materiality, type Materiality, type MaterialityInputs } from './materiality';
import { rankFlags, type RankedFlag } from './rank';
import { RULE_SET_VERSION } from './rule-set-version';
import { r1Flags, r2Flags, r3Flags, type RuleData } from './rules';

export { RULE_SET_VERSION };
export type StoredFlag = RankedFlag & { flagKey: string; ruleVersion: string };
export const flagKey = (ruleId: string, ledger: string) => `${ruleId}:${ledger}`;

// Pure: the same books always give the same ranked list. Gate A has no AI and no answers.
export function buildFlagList(data: RuleData & { company: { materialityInputs: MaterialityInputs } }): { materiality: Materiality; flags: StoredFlag[] } {
  const tb = trialBalance(data.ledgers, data.entries as never);
  const m = materiality({ revenue: tb.revenue, pbt: tb.pbt }, data.company.materialityInputs);
  const ranked = rankFlags([...r1Flags(data), ...r2Flags(data), ...r3Flags(data)], m);
  return { materiality: m, flags: ranked.map(f => ({ ...f, flagKey: flagKey(f.ruleId, f.ledger), ruleVersion: RULE_SET_VERSION })) };
}
