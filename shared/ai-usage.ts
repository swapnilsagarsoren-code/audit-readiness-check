export interface AiCaps { callsPerDay: number; tokensPerDay: number; callsPerRun: number }
export interface UsageReservation { id: string; runId: string; tokens: number }
export interface UsageDay {
  day: string; calls: number; tokensIn: number; tokensOut: number;
  reservations?: UsageReservation[]; runCalls?: { runId: string; calls: number }[];
}
export const OUTPUT_TOKEN_CAP = 500;
// No token-count API call: reserve UTF-8 bytes plus generous message framing.
export const MESSAGE_FRAMING_ALLOWANCE = 1024;
export const MAX_PROMPT_BYTES = 32_000;
export function readAiCaps(env: Record<string, string | undefined>): AiCaps | null {
  const values = ['AI_MAX_CALLS_PER_DAY', 'AI_MAX_TOKENS_PER_DAY', 'AI_MAX_CALLS_PER_RUN'].map(key => env[key]);
  if (!values.every(value => value !== undefined && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)))) return null;
  return { callsPerDay: Number(values[0]), tokensPerDay: Number(values[1]), callsPerRun: Number(values[2]) };
}
export function indiaDay(now: number): string {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}
export function reserveUsage(
  current: UsageDay, allDays: UsageDay[], runId: string, id: string, promptBytes: number, caps: AiCaps,
): { ok: true; usage: UsageDay; reservedTokens: number } | { ok: false; reason: string } {
  if (!Number.isSafeInteger(promptBytes) || promptBytes < 1 || promptBytes > MAX_PROMPT_BYTES) return { ok: false, reason: 'PROMPT_SIZE_INVALID' };
  const reservations = current.reservations ?? [];
  if (reservations.some(item => item.id === id)) return { ok: false, reason: 'RESERVATION_DUPLICATE' };
  if (current.calls >= caps.callsPerDay) return { ok: false, reason: 'DAILY_CALL_CAP' };
  const runCalls = allDays.reduce((count, usage) => count + (usage.runCalls ?? []).filter(item => item.runId === runId).reduce((sum, item) => sum + item.calls, 0), 0);
  if (runCalls >= caps.callsPerRun) return { ok: false, reason: 'RUN_CALL_CAP' };
  const reservedTokens = promptBytes + MESSAGE_FRAMING_ALLOWANCE + OUTPUT_TOKEN_CAP;
  const pending = reservations.reduce((sum, item) => sum + item.tokens, 0);
  if (current.tokensIn + current.tokensOut + pending + reservedTokens > caps.tokensPerDay) return { ok: false, reason: 'DAILY_TOKEN_CAP' };
  const runs = [...(current.runCalls ?? [])];
  const prior = runs.findIndex(item => item.runId === runId);
  if (prior === -1) runs.push({ runId, calls: 1 });
  else runs[prior] = { runId, calls: runs[prior].calls + 1 };
  return { ok: true, reservedTokens, usage: { ...current, calls: current.calls + 1, reservations: [...reservations, { id, runId, tokens: reservedTokens }], runCalls: runs } };
}
export function finishUsage(current: UsageDay, id: string, actual?: { tokensIn: number; tokensOut: number }): UsageDay {
  const reservation = current.reservations?.find(item => item.id === id);
  if (!reservation) throw new Error('AI usage refused: reservation is missing.');
  // Transport failures cannot prove zero billable tokens: retain the reservation.
  if (!actual) return current;
  if (![actual.tokensIn, actual.tokensOut].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('AI usage refused: token counts are invalid.');
  return { ...current, tokensIn: current.tokensIn + actual.tokensIn, tokensOut: current.tokensOut + actual.tokensOut, reservations: current.reservations!.filter(item => item.id !== id) };
}
