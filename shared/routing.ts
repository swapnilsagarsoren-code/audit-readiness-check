import type { RuleId } from './evidence.ts';
import type { ThemeId } from './themes.ts';

export type { RuleId } from './evidence.ts';

export interface Routing {
  theme: ThemeId;
  followupTheme?: ThemeId;
}

// RULES_v1 selects the question type. M1 words only the primary question.
export const ROUTING: Readonly<Record<RuleId, Routing>> = {
  R1: { theme: 2, followupTheme: 1 },
  R2: { theme: 8 },
  R3: { theme: 3 },
  R4: { theme: 4 },
  R5: { theme: 2 },
};

/**
 * One rule-owned question goal per rule (approved by Swapnil 16 Oct 2026; decision log). The AI words this one goal
 * for the flag instead of choosing among theme facets, which led to two-part questions. R3 is RULES_v1's own wording;
 * the others restate RULES_v1's option lists as one question.
 */
export const QUESTION_GOALS: Readonly<Record<RuleId, string>> = {
  R1: 'What was the money received for? Do not suggest an answer, and do not use the words loan, advance or deposit.',
  R2: 'Which Udyam category is this supplier registered in (Micro, Small or Medium), or is it not registered?',
  R3: 'How much of the principal falls due before the next 31 March, or is it repayable on demand or without a fixed schedule?',
  R4: 'Was this work routine upkeep, or did it extend life or capacity, create a new asset, replace a whole major part, or form part of a project still being built?',
  R5: 'What was this credit received for: sale of products, manufacturing scrap, an export incentive, an insurance claim, interest, rent, a foreign-exchange gain, or the sale of a fixed asset?',
};

export function getQuestionGoal(ruleId: RuleId): string {
  const goal = QUESTION_GOALS[ruleId];
  if (!goal) throw new Error('Unknown question rule.');
  return goal;
}

export function getRouting(ruleId: RuleId): Routing {
  const route = ROUTING[ruleId];
  if (!route) throw new Error('Unknown question rule.');
  return { ...route };
}
