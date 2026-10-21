import type { FlagInput } from './flag-input';

const instructionPatterns = [
  ['INSTRUCTION_IGNORE', /\bignore\b/i],
  ['INSTRUCTION_DISREGARD', /\bdisregard\b/i],
  ['ROLE_SYSTEM', /\bsystem\s*:/i],
  ['ROLE_DEVELOPER', /\bdeveloper\s*:/i],
  ['ROLE_USER', /\buser\s*:/i],
  ['ROLE_ASSISTANT', /\bassistant\b/i],
  ['ROLE_ASSIGNMENT', /\byou\s+are\b/i],
  ['PROMPT_LABEL', /\bprompt\s*:/i],
  ['CODE_DELIMITER', /```/],
  ['MARKUP_DELIMITER', /</],
  ['OBJECT_DELIMITER', /\{/],
  ['INSTRUCTION_REPLACEMENT', /\b(?:follow|obey|replace)\s+(?:these|my|the)\s+instructions\b/i],
] as const;

/** Trusted rule text is excluded: braces introduced by JSON are not input text. */
export function scanInjection(input: FlagInput): string[] {
  const values: [string, string][] = [['ledger', input.ledger], ['tallyGroup', input.tallyGroup]];
  input.entries.forEach((entry, index) => {
    for (const field of ['date', 'party', 'narration', 'amount'] as const) {
      values.push([`entries[${index}].${field}`, entry[field]]);
    }
  });
  return values.flatMap(([field, value]) => instructionPatterns
    .filter(([, pattern]) => pattern.test(value))
    .map(([reason]) => `${field}:${reason}`));
}
