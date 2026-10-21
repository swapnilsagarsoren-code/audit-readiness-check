import { R1_FOLLOWUPS } from '../shared/r1-question.ts';

export type Selection = { nature?: string; counterparty?: string; term?: string; declaration?: string };
type Followup = (typeof R1_FOLLOWUPS)[number];

export function visibleFollowups(sel: Selection): Followup[] {
  if (sel.nature !== 'loan') return [];
  return R1_FOLLOWUPS.filter(f => !f.onlyFor || (sel.counterparty !== undefined && f.onlyFor.includes(sel.counterparty)));
}
export function refusalText(reason: string, story = false): string {
  if (reason === 'wrong') return story ? 'That sign-off code is wrong.' : 'That passcode is wrong.';
  if (reason === 'no_session' || reason === 'expired') return 'This session has ended. Start a new one.';
  if (reason === 'slow_down') return "You've saved a lot this hour. Try again in a few minutes.";
  if (reason === 'busy') return "The demo has reached today's limit. Try again tomorrow.";
  if (reason === 'locked') return 'Too many wrong tries this hour. Edits are locked until the next hour.';
  if (reason === 'disabled') return 'Edits are not switched on for this deployment.';
  return "Couldn't save. Nothing was changed.";
}

