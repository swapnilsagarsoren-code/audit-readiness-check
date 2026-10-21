import { readFileSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseDevDeployment, assertApprovedDev, assertNoAlternateSelectors,
} from './seed-dev.mjs';
import { EVIDENCE_BY_RULE } from '../shared/evidence.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const RUNS = 3;
/**
 * Held-out set v5 (H33–H40), frozen 20 Oct 2026 after the timestamp and fronted-phrase fixes (AGENTS.md §4).
 * Never edit the file to raise its score.
 * Retired after their results drove fixes (kept, not run): v1 (H1–H8) tests/fixtures/m1-heldout-v1-retired.json,
 * v2 (H9–H16) tests/fixtures/m1-heldout-v2-retired.json, v3 (H17–H24) tests/fixtures/m1-heldout-v3-retired.json,
 * v4 (H25–H32) tests/fixtures/m1-heldout-v4-retired.json.
 */
export const HELDOUT_SHA256 = 'ac50eb540c93daae6420881754e86652482d7caa2c35dc60e0abfbbaf05df374';
const HELDOUT_CASES = 8;
/** A pilot runs a few development cases only; it is never scored against the pass marks. */
const PILOT_MAX_CASES = 6;
const isPositive = flag => flag.flagKey.startsWith('P');
const isHeldout = flag => flag.flagKey.startsWith('H');
const alternateSelectors = ['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY'];
const statuses = new Set(['verified', 'rejected', 'blocked_injection', 'failed', 'cap_hit', 'disabled']);
const quoteFields = new Set(['ledger', 'tallyGroup', 'party', 'narration', 'date', 'amount', 'totalAmount', 'entryCount']);
const refusal = message => new Error(`Evaluation refused: ${message}`);
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0;

/** Only selector assignments are inspected; configuration values never enter messages. */
export function validateEvalDeployment(contents, defaults = '', env = {}) {
  const deployment = parseDevDeployment(contents);
  assertApprovedDev(deployment);
  assertNoAlternateSelectors(contents, env);
  assertNoAlternateSelectors(defaults, {});
  if (alternateSelectors.some(key => Object.hasOwn(env, key) && env[key] !== undefined)) {
    throw refusal('an alternate Convex credential or self-hosted selector is present.');
  }
  if (env.CONVEX_DEPLOYMENT !== undefined && env.CONVEX_DEPLOYMENT !== `dev:${deployment}`) {
    throw refusal('the inherited deployment selector does not match the approved cloud dev project.');
  }
  if (/^\s*(?:export\s+)?CONVEX_DEPLOYMENT\s*=/m.test(defaults)) {
    assertApprovedDev(parseDevDeployment(defaults));
  }
  return deployment;
}

/** Check the handwritten/generated fixtures before any CLI process is started. */
export function validateEvalFlags(positive, adversarial, heldout) {
  if (!Array.isArray(positive) || positive.length !== 17 || !Array.isArray(adversarial) || adversarial.length !== 3
    || !Array.isArray(heldout) || heldout.length !== HELDOUT_CASES) {
    throw refusal('fixtures must contain 17 positive, 3 adversarial and 8 held-out cases.');
  }
  const flags = [...positive, ...adversarial, ...heldout];
  const keys = new Set();
  const prefixOk = (flag, index) => typeof flag.flagKey === 'string' && (index < positive.length ? isPositive(flag)
    : index < positive.length + adversarial.length ? !isPositive(flag) && !isHeldout(flag) : isHeldout(flag));
  for (const [index, flag] of flags.entries()) {
    if (!plainObject(flag) || Object.keys(flag).sort().join(',') !== 'entries,flagKey,ledgerName,ruleId,tallyGroup'
      || typeof flag.flagKey !== 'string' || !/^[A-Za-z0-9_-]+$/.test(flag.flagKey)
      || keys.has(flag.flagKey) || !prefixOk(flag, index)
      || !Object.hasOwn(EVIDENCE_BY_RULE, flag.ruleId)
      || typeof flag.ledgerName !== 'string' || !flag.ledgerName.trim()
      || typeof flag.tallyGroup !== 'string' || !flag.tallyGroup.trim()
      || !Array.isArray(flag.entries) || flag.entries.length === 0) {
      throw refusal('a flag fixture has an invalid or duplicate case identity.');
    }
    keys.add(flag.flagKey);
    for (const entry of flag.entries) {
      if (!plainObject(entry) || Object.keys(entry).sort().join(',') !== 'amountPaise,date,lineNo,narration,party,voucherNo'
        || !['date', 'party', 'narration', 'voucherNo'].every(field => typeof entry[field] === 'string')
        || !Number.isSafeInteger(entry.amountPaise) || !nonnegativeInteger(entry.lineNo)) {
        throw refusal('a flag fixture contains an invalid voucher line.');
      }
    }
  }
  return flags;
}

function validateRow(row, cases, runId) {
  const flag = cases.get(row?.flagKey);
  if (!plainObject(row) || !flag || row.ruleId !== flag.ruleId || row.runId !== runId
    || !statuses.has(row.status) || !Number.isSafeInteger(row.theme)
    || (row.followupTheme !== undefined && !Number.isSafeInteger(row.followupTheme))
    || !['questionText', 'model', 'inputHash'].every(field => typeof row[field] === 'string')
    || !Array.isArray(row.evidenceIds) || !row.evidenceIds.every(id => typeof id === 'string')
    || !Array.isArray(row.reasons) || !row.reasons.every(reason => typeof reason === 'string')
    || !Array.isArray(row.quotes) || !row.quotes.every(quote => plainObject(quote) && quoteFields.has(quote.field) && typeof quote.text === 'string')
    || !['inventedCount', 'tokensIn', 'tokensOut', 'createdAt'].every(field => nonnegativeInteger(row[field]))
    || !(row.attempt === 1 || row.attempt === 2)
    || !(Number.isSafeInteger(row.runNumber) && row.runNumber >= 1 && row.runNumber <= RUNS)) {
    throw refusal('stored question readback is incomplete or does not match this evaluation.');
  }
  if (row.status === 'verified' && (row.evidenceIds.length < 1 || row.evidenceIds.length > 3
    || new Set(row.evidenceIds).size !== row.evidenceIds.length
    || !row.evidenceIds.every(id => EVIDENCE_BY_RULE[row.ruleId].some(item => item.id === id)))) {
    throw refusal('a verified row contains invalid evidence selections.');
  }
}

const markdownCell = value => String(value).replaceAll('|', '\\|').replace(/\r?\n/g, ' ');

/** Readback, rather than the action response, supplies the evaluation evidence. */
export function buildEvalReport(flags, rows, runId, { pilot = false } = {}) {
  if (!Array.isArray(rows)) throw refusal('stored question readback is not a list.');
  const cases = new Map(flags.map(flag => [flag.flagKey, flag]));
  const byCase = new Map(flags.map(flag => [flag.flagKey, []]));
  for (const row of rows) {
    validateRow(row, cases, runId);
    byCase.get(row.flagKey).push(row);
  }
  const reportRows = [];
  // Per case and run: the first try, and the single retry if one was made.
  const finals = [];
  for (const flag of flags) {
    const caseRows = byCase.get(flag.flagKey);
    const firsts = caseRows.filter(row => row.attempt === 1);
    const retries = caseRows.filter(row => row.attempt === 2);
    const runNumbers = firsts.map(row => row.runNumber);
    if (firsts.length !== RUNS || new Set(runNumbers).size !== RUNS) {
      throw refusal('stored questions must contain exactly one first try for each of the three runs of every case.');
    }
    for (const retry of retries) {
      const first = firsts.find(row => row.runNumber === retry.runNumber);
      if (retries.filter(row => row.runNumber === retry.runNumber).length !== 1 || first.status !== 'rejected') {
        throw refusal('a stored retry does not follow exactly one rejected first try.');
      }
    }
    caseRows.sort((a, b) => a.runNumber - b.runNumber || a.attempt - b.attempt);
    for (const row of caseRows) {
      // Copy only documented fields, never arbitrary CLI or provider metadata.
      reportRows.push({
        case: flag.flagKey, set: isHeldout(flag) ? 'heldout' : 'dev', rule: flag.ruleId, run: row.runNumber, attempt: row.attempt,
        status: row.status, question: row.questionText,
        evidenceIds: row.evidenceIds,
        evidenceLabels: row.evidenceIds.map(id => EVIDENCE_BY_RULE[flag.ruleId].find(item => item.id === id)?.label ?? `[not approved: ${id}]`),
        reasons: row.reasons, inventedCount: row.inventedCount,
        theme: row.theme, ...(row.followupTheme !== undefined ? { followupTheme: row.followupTheme } : {}),
        quotes: row.quotes.map(({ field, text }) => ({ field, text })), model: row.model,
        inputHash: row.inputHash, tokensIn: row.tokensIn, tokensOut: row.tokensOut,
        runId: row.runId, createdAt: row.createdAt,
      });
    }
    for (const first of firsts) {
      const retry = retries.find(row => row.runNumber === first.runNumber);
      // A retry that got no reply never replaces the first try.
      finals.push(retry && ['verified', 'rejected'].includes(retry.status) ? retry : first);
    }
  }
  const setOf = row => isHeldout(cases.get(row.flagKey)) ? 'heldout' : 'dev';
  const counts = rows => ({
    verified: rows.filter(row => row.status === 'verified').length,
    rejected: rows.filter(row => row.status === 'rejected').length,
    blocked: rows.filter(row => row.status === 'blocked_injection').length,
    failed: rows.filter(row => ['failed', 'cap_hit', 'disabled'].includes(row.status)).length,
  });
  const invented = rows => rows.reduce((sum, row) => sum + row.inventedCount, 0);
  const all3 = (rows, include) => flags.filter(include)
    .filter(flag => rows.filter(row => row.flagKey === flag.flagKey).every(row => row.status === 'verified')).length;
  const firstRows = rows.filter(row => row.attempt === 1);
  const devFlags = flags.filter(flag => !isHeldout(flag));
  // Locked pass marks are judged on first tries only; after-retry lines are extra information.
  const firstTry = (set, include) => {
    const subset = firstRows.filter(row => setOf(row) === set);
    return { ...counts(subset), invented: invented(subset), all3VerifiedCases: all3(subset, include) };
  };
  const afterRetry = (set, include) => {
    const subset = finals.filter(row => setOf(row) === set);
    const attempts = rows.filter(row => setOf(row) === set);
    return { retries: attempts.filter(row => row.attempt === 2).length, ...counts(subset), invented: invented(attempts), all3VerifiedCases: all3(subset, include) };
  };
  const summary = {
    cases: devFlags.length, positiveCases: devFlags.filter(isPositive).length,
    adversarialCases: devFlags.filter(flag => !isPositive(flag)).length, runs: RUNS,
    ...firstTry('dev', isPositive),
    afterRetry: afterRetry('dev', isPositive),
    heldout: {
      cases: flags.length - devFlags.length, runs: RUNS, ...firstTry('heldout', isHeldout),
      afterRetry: afterRetry('heldout', isHeldout),
    },
  };
  const fields = values => `verified=${values.verified} rejected=${values.rejected} blocked=${values.blocked} failed=${values.failed} invented=${values.invented} all3_verified_cases=${values.all3VerifiedCases}`;
  const held = summary.heldout;
  const line = `EVAL_M1 cases=${summary.cases} runs=${RUNS} ${fields(summary)}`;
  const heldoutLine = `HELDOUT_M1 cases=${held.cases} runs=${RUNS} ${fields(held)}`;
  const retryLine = `EVAL_M1_AFTER_RETRY cases=${summary.cases} runs=${RUNS} retries=${summary.afterRetry.retries} ${fields(summary.afterRetry)}`;
  const heldoutRetryLine = `HELDOUT_M1_AFTER_RETRY cases=${held.cases} runs=${RUNS} retries=${held.afterRetry.retries} ${fields(held.afterRetry)}`;
  const devRows = reportRows.filter(row => row.set === 'dev');
  const heldoutRows = reportRows.filter(row => row.set === 'heldout');
  const table = rows => [
    '| case | rule | run | attempt | status | question | evidence labels | reasons |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${[row.case, row.rule, row.run, row.attempt, row.status, row.question, row.evidenceLabels.join('; '), row.reasons.join('; ')].map(markdownCell).join(' | ')} |`),
  ].join('\n');
  const passNote = 'The locked pass marks are judged on the first-try line. The after-retry line counts invented facts across both attempts and is reported for information only.';
  if (pilot) {
    const twoPart = rows.filter(row => row.reasons.includes('QUESTION_SENTENCE_COUNT')).length;
    const pilotLine = `PILOT_M1 cases=${summary.cases} runs=${RUNS} ${fields(summary)} retries=${summary.afterRetry.retries} two_part_answers=${twoPart} answers=${rows.length}`;
    const markdown = `## Pilot (development cases only; not scored against the pass marks)\n\n${table(devRows)}\n\n\`${pilotLine}\`\n`;
    return { json: { runId, pilot: true, summary, rows: reportRows }, markdown, line: pilotLine, retryLine: '', heldoutLine: '', heldoutRetryLine: '', lines: [pilotLine] };
  }
  const markdown = `## Development set (17 planted positives + 3 adversarial)\n\n${table(devRows)}\n\n\`${line}\`\n\n\`${retryLine}\`\n\nThe all3_verified_cases count covers only the ${summary.positiveCases} planted positive cases. Adversarial cases are reported separately in the table. ${passNote}\n\n## Held-out set v5 (frozen 20 Oct 2026, written independently, never tuned on)\n\n${table(heldoutRows)}\n\n\`${heldoutLine}\`\n\n\`${heldoutRetryLine}\`\n\nEvidence fit and question clarity still require Swapnil's review. Synthetic data only.\n`;
  return { json: { runId, summary, rows: reportRows }, markdown, line, heldoutLine, retryLine, heldoutRetryLine, lines: [line, retryLine, heldoutLine, heldoutRetryLine] };
}

/** IST timestamp for archive names, e.g. 2026-10-16_1850. */
export function istStamp(now) {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 16).replace('T', '_').replace(':', '');
}

/** Every run is kept: a dated copy of its report plus a summary appended to eval-log.md. */
export function archiveRun(report, { now = Date.now(), directory = resolve(root, 'artifacts/m1'),
  write = writeFileSync, append = appendFileSync, mkdir = mkdirSync } = {}) {
  const stamp = istStamp(now);
  // The full run id keeps names unique; 'wx' refuses to overwrite an existing archive.
  const base = `${stamp}_${report.json.runId}${report.json.pilot ? '_pilot' : ''}`;
  mkdir(resolve(directory, 'runs'), { recursive: true });
  write(resolve(directory, 'runs', `${base}.json`), `${JSON.stringify(report.json, null, 2)}\n`, { flag: 'wx' });
  write(resolve(directory, 'runs', `${base}.md`), report.markdown, { flag: 'wx' });
  append(resolve(directory, 'eval-log.md'), `\n## Run ${stamp.replace('_', ' ')} IST — ${report.json.runId}${report.json.pilot ? ' (pilot, not scored)' : ''} (auto-logged)\n\n\`\`\`text\n${report.lines.join('\n')}\n\`\`\`\n\nDetail: runs/${base}.md. Findings: to be added after review.\n`);
  return base;
}

/** All injected runners in unit tests are offline stubs; the builder never runs this pipeline. */
export function runEvalSteps(deployment, flags, {
  run = spawnSync, env = process.env, runId = `m1-${randomUUID()}`, pilot = false,
  log = console.log, error = console.error, writeArtifacts = report => {
    const directory = resolve(root, 'artifacts/m1');
    mkdirSync(directory, { recursive: true });
    // A pilot never overwrites the scored eval.json / eval.md.
    if (!report.json.pilot) {
      writeFileSync(resolve(directory, 'eval.json'), `${JSON.stringify(report.json, null, 2)}\n`);
      writeFileSync(resolve(directory, 'eval.md'), report.markdown);
    }
    archiveRun(report, { directory });
  },
} = {}) {
  assertApprovedDev(deployment);
  assertNoAlternateSelectors('', env);
  if (alternateSelectors.some(key => Object.hasOwn(env, key) && env[key] !== undefined)
    || (env.CONVEX_DEPLOYMENT !== undefined && env.CONVEX_DEPLOYMENT !== `dev:${deployment}`)) {
    throw refusal('an inherited selector does not match the approved cloud dev configuration.');
  }
  if (typeof runId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(runId)) throw refusal('the run identifier is invalid.');
  if (pilot) {
    if (!Array.isArray(flags) || flags.length < 1 || flags.length > PILOT_MAX_CASES || !flags.every(isPositive)) {
      throw refusal('a pilot runs 1 to 6 development cases only.');
    }
  } else {
    validateEvalFlags(flags.filter(isPositive), flags.filter(flag => !isPositive(flag) && !isHeldout(flag)), flags.filter(isHeldout));
  }
  const childEnv = { ...env, CONVEX_DEPLOYMENT: `dev:${deployment}`, CONVEX_ALLOW_ANONYMOUS: 'false' };
  const steps = [{ name: 'push dev functions', args: ['--no-install', 'convex', 'dev', '--once'] }];
  for (const flag of flags) {
    for (let runNumber = 1; runNumber <= RUNS; runNumber++) {
      steps.push({ name: `case ${flag.flagKey} run ${runNumber}`, args: ['--no-install', 'convex', 'run', '--deployment', deployment, 'ai:wordQuestion', JSON.stringify({ flag, runId, runNumber })] });
    }
  }
  steps.push({ name: 'read stored questions', args: ['--no-install', 'convex', 'run', '--deployment', deployment, 'ai:questionsForRun', JSON.stringify({ runId })], readback: true });
  for (const step of steps) {
    log(`EVAL_STEP ${step.name}`);
    let result;
    try {
      // CLI stderr is deliberately captured and never echoed: provider errors can include secrets.
      result = run('npx', step.args, { cwd: root, env: childEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
    } catch {
      error(`Evaluation stopped: ${step.name} could not start; external error text was withheld.`);
      return 1;
    }
    if (result.error || result.status !== 0) {
      error(`Evaluation stopped: ${step.name} did not complete; CLI output was withheld.`);
      return Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    }
    if (step.readback) {
      let report;
      try { report = buildEvalReport(flags, JSON.parse(result.stdout), runId, { pilot }); } catch {
        error('Evaluation stopped: stored question readback was invalid; CLI output was withheld.');
        return 1;
      }
      try { writeArtifacts(report); } catch {
        error('Evaluation stopped: report artifacts could not be written.');
        return 1;
      }
      for (const line of report.lines) log(line);
    }
  }
  return 0;
}

/** `--pilot=P5,P6` selects development cases for an unscored pilot. */
export function parsePilot(argv) {
  const arg = argv.find(value => value.startsWith('--pilot='));
  if (!arg) return undefined;
  const keys = arg.slice('--pilot='.length).split(',').filter(Boolean);
  if (keys.length < 1 || keys.length > PILOT_MAX_CASES || new Set(keys).size !== keys.length || !keys.every(key => /^P\d{1,2}$/.test(key))) {
    throw refusal('a pilot names 1 to 6 distinct development cases, e.g. --pilot=P5,P8.');
  }
  return keys;
}

/** @param {Parameters<typeof runEvalSteps>[2] & {read?: typeof readFileSync, heldoutSha256?: string, argv?: string[]}} options */
export function main({ read = readFileSync, env = process.env, log = console.log, error = console.error, heldoutSha256 = HELDOUT_SHA256, argv = process.argv.slice(2), ...options } = {}) {
  try {
    let contents, defaults = '';
    try { contents = read(resolve(root, '.env.local'), 'utf8'); } catch { throw refusal('.env.local could not be checked.'); }
    try { defaults = read(resolve(root, '.env'), 'utf8'); } catch (err) {
      if (err.code !== 'ENOENT') throw refusal('default environment configuration could not be checked.');
    }
    const deployment = validateEvalDeployment(contents, defaults, env);
    let positive, adversarial, heldoutText, heldout;
    try {
      positive = JSON.parse(read(resolve(root, 'tests/fixtures/m1-flags.json'), 'utf8'));
      adversarial = JSON.parse(read(resolve(root, 'tests/fixtures/m1-adversarial.json'), 'utf8'));
      heldoutText = read(resolve(root, 'tests/fixtures/m1-heldout.json'), 'utf8');
      heldout = JSON.parse(heldoutText);
    } catch { throw refusal('flag fixtures could not be checked.'); }
    if (createHash('sha256').update(heldoutText).digest('hex') !== heldoutSha256) {
      throw refusal('the frozen held-out set has changed.');
    }
    const flags = validateEvalFlags(positive, adversarial, heldout);
    const pilotKeys = parsePilot(argv);
    if (pilotKeys) {
      const selected = pilotKeys.map(key => positive.find(flag => flag.flagKey === key));
      if (selected.some(flag => !flag)) throw refusal('a pilot case is not a development case.');
      return runEvalSteps(deployment, selected, { env, log, error, pilot: true, ...options });
    }
    return runEvalSteps(deployment, flags, { env, log, error, ...options });
  } catch (err) {
    const message = err instanceof Error && /^(?:Seeding|Evaluation) refused:/.test(err.message)
      ? err.message.replace(/^Seeding/, 'Evaluation') : 'Evaluation refused: configuration validation failed.';
    error(message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
