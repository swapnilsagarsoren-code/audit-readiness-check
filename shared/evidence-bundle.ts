import { getEvidence, type EvidenceItem, type RuleId } from './evidence';

// Decision #33: documents to ask for are listed by code, never chosen by the AI.
// R1: everything except the board resolution, which is added only once the answer is a loan.
// R2, R3, R4: the whole approved list. R5 (matching plus related documents) is not built yet.
export function evidenceBundle(ruleId: RuleId, answer: { isLoan?: boolean } = {}): EvidenceItem[] {
  if (ruleId === 'R5') throw new Error('Evidence bundles for R5 are not built yet.');
  const all = getEvidence(ruleId);
  return ruleId === 'R1' && answer.isLoan !== true ? all.filter(item => item.id !== 'R1-BOARD-RESOLUTION') : all;
}
