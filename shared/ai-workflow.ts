import { buildFlagInput, type RawFlag } from './flag-input';
import { getRouting } from './routing';
import { scanInjection } from './injection';
import { buildAiPrompt, RETRY_NOTES, type RetryReason } from './ai-prompt';
import { verifyReply, type Quote } from './verify';
import { MAX_PROMPT_BYTES, OUTPUT_TOKEN_CAP, readAiCaps } from './ai-usage';

export const QUESTION_NOT_READY = 'Question not ready — the rule flag still stands. Try again later.';
export type QuestionStatus = 'verified' | 'rejected' | 'blocked_injection' | 'failed' | 'cap_hit' | 'disabled';
export interface QuestionRow {
  flagKey: string; ruleId: RawFlag['ruleId']; theme: number; followupTheme?: number;
  questionText: string; evidenceIds: string[]; quotes: Quote[];
  status: QuestionStatus; reasons: string[]; inventedCount: number; model: string; inputHash: string;
  tokensIn: number; tokensOut: number; runId: string; createdAt: number;
  /** 1 = first try; 2 = the single retry after a fixable rejection. */
  attempt?: number;
  /** Which of the eval's repeated runs this row belongs to, so a retry pairs with its first try. */
  runNumber?: number;
}
export interface WorkflowDependencies {
  reserve: (runId: string, promptBytes: number) => Promise<{ ok: boolean; reason?: string; day?: string; reservationId?: string }>;
  save: (row: QuestionRow, reservation?: { day: string; id: string; actual?: { tokensIn: number; tokensOut: number } }) => Promise<void>;
  knownNames: () => Promise<string[]>;
  fetch: typeof globalThis.fetch;
  now: () => number;
}
const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
function validModel(model: string | undefined): model is string { return !!model && /^claude-haiku-[a-zA-Z0-9.-]+$/.test(model); }
function containsSecret(value: unknown, secret: string): boolean {
  if (typeof value === 'string') return value.includes(secret);
  if (Array.isArray(value)) return value.some(item => containsSecret(item, secret));
  if (value && typeof value === 'object') return Object.values(value).some(item => containsSecret(item, secret));
  return false;
}
function tokenUsage(value: unknown): { tokensIn: number; tokensOut: number } | undefined {
  if (!value || typeof value !== 'object') return;
  const usage = value as Record<string, unknown>;
  const input = usage.input_tokens, output = usage.output_tokens;
  const cacheCreate = usage.cache_creation_input_tokens ?? 0, cacheRead = usage.cache_read_input_tokens ?? 0;
  if (![input, output, cacheCreate, cacheRead].every(item => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0)) return;
  const tokensIn = Number(input) + Number(cacheCreate) + Number(cacheRead);
  if (!Number.isSafeInteger(tokensIn)) return;
  return { tokensIn, tokensOut: Number(output) };
}
const RETRYABLE = new Set<string>(Object.keys(RETRY_NOTES));
const validRunNumber = (value: number | undefined): value is number => Number.isSafeInteger(value) && value! >= 1 && value! <= 100;
type AttemptResult = { status: QuestionStatus; message: string; retry?: RetryReason[] };

/** One first try, plus at most one retry when every rejection reason is fixable wording and nothing was invented. */
export async function runWordQuestion(flag: RawFlag, runId: string, env: Record<string, string | undefined>, deps: WorkflowDependencies, runNumber?: number) {
  const first = await runAttempt(flag, runId, env, deps, runNumber, 1, []);
  if (!first.retry) return { status: first.status, message: first.message };
  const second = await runAttempt(flag, runId, env, deps, runNumber, 2, first.retry);
  // A retry that got no reply (cap, transport, guard) never replaces the first try's result.
  const final = second.status === 'verified' || second.status === 'rejected' ? second : first;
  return { status: final.status, message: final.message };
}

async function runAttempt(
  flag: RawFlag, runId: string, env: Record<string, string | undefined>, deps: WorkflowDependencies,
  runNumber: number | undefined, attempt: 1 | 2, retryReasons: RetryReason[],
): Promise<AttemptResult> {
  const route = getRouting(flag.ruleId);
  let row: QuestionRow = { flagKey: flag.flagKey, ruleId: flag.ruleId, theme: route.theme,
    ...(route.followupTheme === undefined ? {} : { followupTheme: route.followupTheme }),
    questionText: '', evidenceIds: [], quotes: [], status: 'failed', reasons: [], inventedCount: 0,
    model: validModel(env.AI_MODEL) ? env.AI_MODEL : '', inputHash: EMPTY_HASH, tokensIn: 0, tokensOut: 0, runId, createdAt: deps.now(),
    attempt, ...(validRunNumber(runNumber) ? { runNumber } : {}) };
  let reservation: { day: string; id: string; actual?: { tokensIn: number; tokensOut: number } } | undefined;
  const finish = async (status: QuestionStatus, reasons: string[]): Promise<AttemptResult> => {
    const secret = env.ANTHROPIC_API_KEY;
    if (secret && containsSecret({row,reasons},secret)) {
      status = status === 'disabled' ? 'disabled' : status === 'verified' || status === 'rejected' ? 'rejected' : 'failed';
      reasons = ['SECRET_REDACTED'];
      row.questionText = ''; row.evidenceIds = []; row.quotes = []; row.inventedCount = 0;
      for (const field of ['flagKey','runId','model','inputHash'] as const) if (row[field].includes(secret)) row[field] = 'withheld';
    }
    row.status = status; row.reasons = reasons;
    await deps.save(row, reservation);
    return { status, message: status === 'verified' ? 'Question stored for later review.' : QUESTION_NOT_READY };
  };
  // These guards precede input processing, reservations and provider access.
  if (env.AI_ALLOWED !== 'dev-only') return finish('disabled', ['AI_NOT_ALLOWED']);
  if (env.AI_ENABLED !== 'true') return finish('disabled', ['AI_DISABLED']);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(runId) || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(flag.flagKey)
    || (runNumber !== undefined && !validRunNumber(runNumber))) return finish('failed', ['INVALID_RUN_OR_FLAG_KEY']);
  try {
    const input = buildFlagInput(flag);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)));
    row.inputHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const injections = scanInjection(input);
    if (injections.length) return finish('blocked_injection', injections);
    if (!readAiCaps(env)) return finish('disabled', ['AI_CAPS_INVALID']);
    if (!validModel(env.AI_MODEL)) return finish('disabled', ['AI_MODEL_INVALID']);
    const key = env.ANTHROPIC_API_KEY;
    if (!key || key.trim() !== key || /[\r\n]/.test(key)) return finish('failed', ['AI_KEY_MISSING_OR_INVALID']);
    const prompt = buildAiPrompt(input, retryReasons);
    if (prompt.system.includes(key) || prompt.user.includes(key) || row.model.includes(key) || row.flagKey.includes(key) || runId.includes(key)) {
      row.model = ''; row.flagKey = 'withheld'; row.runId = 'withheld';
      return finish('failed', ['SECRET_IN_INPUT']);
    }
    const promptBytes = new TextEncoder().encode(prompt.system + prompt.user).length;
    if (promptBytes > MAX_PROMPT_BYTES) return finish('failed', ['PROMPT_SIZE_INVALID']);
    const reserved = await deps.reserve(runId, promptBytes);
    if (!reserved.ok) return finish('cap_hit', [reserved.reason ?? 'USAGE_RESERVATION_REFUSED']);
    if (!reserved.day || !reserved.reservationId) return finish('failed', ['USAGE_RESERVATION_INVALID']);
    reservation = { day: reserved.day, id: reserved.reservationId };
    const response = await deps.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': key },
      body: JSON.stringify({ model: env.AI_MODEL, max_tokens: OUTPUT_TOKEN_CAP,
        thinking: { type: 'disabled' }, output_config: { effort: 'high' },
        system: prompt.system, messages: [{ role: 'user', content: prompt.user }] }),
    });
    // Never use provider error bodies or external exception text.
    if (!response.ok) return finish('failed', ['AI_HTTP_FAILED', 'TOKENS_UNCONFIRMED']);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') return finish('failed', ['AI_RESPONSE_INVALID', 'TOKENS_UNCONFIRMED']);
    const data = payload as Record<string, unknown>;
    const usage = tokenUsage(data.usage);
    if (!usage) return finish('failed', ['AI_USAGE_INVALID', 'TOKENS_UNCONFIRMED']);
    reservation.actual = usage; row.tokensIn = usage.tokensIn; row.tokensOut = usage.tokensOut;
    if (usage.tokensIn > promptBytes + 1024 || usage.tokensOut > OUTPUT_TOKEN_CAP) return finish('failed', ['AI_TOKEN_BOUND_EXCEEDED']);
    if (!Array.isArray(data.content) || data.stop_reason !== 'end_turn') return finish('failed', ['AI_RESPONSE_INVALID']);
    const block = data.content.find(candidate => candidate && typeof candidate === 'object' && candidate.type === 'text');
    if (!block || typeof block !== 'object' || block.type !== 'text' || typeof block.text !== 'string') return finish('failed', ['AI_RESPONSE_INVALID']);
    if (block.text.includes(key)) return finish('rejected', ['SECRET_IN_REPLY']);
    const verified = verifyReply(block.text, input, await deps.knownNames());
    row = { ...row, questionText: verified.question, evidenceIds: verified.evidenceIds, quotes: verified.quotes,
      inventedCount: verified.inventedCount };
    const result = await finish(verified.status, [...verified.reasons, ...verified.quoteMisses.map(miss => `QUOTE_MISS:${miss}`)]);
    // Decided on the verifier's own reasons (not the stored QUOTE_MISS diagnostics); never after a scrubbed secret.
    const fixable = attempt === 1 && result.status === 'rejected' && verified.status === 'rejected' && verified.inventedCount === 0
      && row.reasons[0] !== 'SECRET_REDACTED' && verified.reasons.length > 0 && verified.reasons.every(reason => RETRYABLE.has(reason));
    return fixable ? { ...result, retry: verified.reasons as RetryReason[] } : result;
  } catch {
    // A timed-out/unknown provider result keeps its token reservation fail-closed.
    return finish('failed', ['AI_CALL_FAILED', ...(reservation?.actual ? [] : reservation ? ['TOKENS_UNCONFIRMED'] : [])]);
  }
}
