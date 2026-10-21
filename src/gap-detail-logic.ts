import { R1_FOLLOWUPS } from '../shared/r1-question.ts';

export type Selection = { nature?: string; counterparty?: string; term?: string; declaration?: string };
type Followup = (typeof R1_FOLLOWUPS)[number];

export function visibleFollowups(sel: Selection): Followup[] {
  if (sel.nature !== 'loan') return [];
  return R1_FOLLOWUPS.filter(f => !f.onlyFor || (sel.counterparty !== undefined && f.onlyFor.includes(sel.counterparty)));
}
export function refusalText(reason: string): string {
  if (reason === 'wrong') return 'That passcode is wrong.';
  if (reason === 'locked') return 'Too many wrong tries this hour. Edits are locked until the next hour.';
  if (reason === 'disabled') return 'Edits are not switched on for this deployment.';
  return "Couldn't save. Nothing was changed.";
}

