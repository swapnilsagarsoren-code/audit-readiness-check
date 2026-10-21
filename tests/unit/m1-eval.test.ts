import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  validateEvalDeployment, validateEvalFlags, buildEvalReport, runEvalSteps, main, HELDOUT_SHA256,
  archiveRun, istStamp, parsePilot,
} from '../../scripts/eval-m1.mjs';

const deployment = 'your-dev-deployment';
const runId = 'm1-offline-test';
const selector = `CONVEX_DEPLOYMENT=dev:${deployment}`;
const fixtures = Array.from({ length: 28 }, (_, index) => ({
  flagKey: index < 17 ? `P${String(index + 1).padStart(2, '0')}` : index < 20 ? `A${index - 16}` : `H${index - 19}`,
  ruleId: 'R1', ledgerName: 'Synthetic Loan', tallyGroup: 'Unsecured Loans',
  entries: [{ date: '2026-03-31', party: 'Synthetic Lender', narration: 'Loan receipt', amountPaise: 56_000_000, voucherNo: `V${index + 1}`, lineNo: 1 }],
}));

const heldoutText = JSON.stringify(fixtures.slice(20));
const heldoutHash = createHash('sha256').update(heldoutText).digest('hex');

type StoredRow = {
  _id: string; _creationTime: number; flagKey: string; ruleId: string; theme: number;
  questionText: string; evidenceIds: string[]; quotes: { field: string; text: string }[];
  status: string; reasons: string[]; inventedCount: number; model: string; inputHash: string;
  tokensIn: number; tokensOut: number; runId: string; createdAt: number; attempt: number; runNumber: number;
};

function makeRows(): StoredRow[] {
  return fixtures.flatMap((flag, index) => Array.from({ length: 3 }, (_, run) => ({
    _id: `synthetic-${index}-${run}`, _creationTime: index * 3 + run,
    flagKey: flag.flagKey, ruleId: flag.ruleId, theme: 2,
    questionText: 'What are the loan terms?', evidenceIds: ['R1-LOAN-AGREEMENT'],
    quotes: [{ field: 'ledger', text: flag.ledgerName }], status: 'verified', reasons: [],
    inventedCount: 0, model: 'synthetic-model', inputHash: 'synthetic-hash',
    tokensIn: 100, tokensOut: 25, runId, createdAt: index * 3 + run, attempt: 1, runNumber: run + 1,
  })));
}

type ProcessCall = { command: string; args: string[]; options: { env: Record<string, string>; stdio: string[]; cwd: string } };

function runScenario({ failAt = -1, failureCode = 23, output = JSON.stringify(makeRows()), throwAt = -1, artifactFails = false } = {}) {
  const calls: ProcessCall[] = [];
  const messages: string[] = [], errors: string[] = [], reports: any[] = [];
  const run = (command: string, args: string[], options: ProcessCall['options']) => {
    const index = calls.length;
    calls.push({ command, args, options });
    if (index === throwAt) throw new Error('synthetic-sensitive-launch-error');
    return { status: index === failAt ? failureCode : 0, stdout: index === 85 ? output : 'synthetic-sensitive-cli-output', stderr: 'synthetic-sensitive-cli-stderr' };
  };
  const code = runEvalSteps(deployment, fixtures, {
    run: run as never, env: { PATH: '/synthetic-path' }, runId,
    log: (message: string) => messages.push(message), error: (message: string) => errors.push(message),
    writeArtifacts: (report: any) => { if (artifactFails) throw new Error('synthetic-sensitive-write-error'); reports.push(report); },
  });
  return { code, calls, messages, errors, reports };
}

test('evaluation guards reuse the approved cloud dev selector and accept matching defaults', () => {
  assert.equal(validateEvalDeployment(selector, '', {}), deployment);
  assert.equal(validateEvalDeployment(selector, selector, { CONVEX_DEPLOYMENT: `dev:${deployment}` }), deployment);
});

for (const [label, local, defaults, env] of [
  ['missing local selector', '', '', {}],
  ['production local selector', 'CONVEX_DEPLOYMENT=prod:synthetic-prod', '', {}],
  ['different local dev', 'CONVEX_DEPLOYMENT=dev:synthetic-dev', '', {}],
  ['production inherited selector', selector, '', { CONVEX_DEPLOYMENT: 'prod:synthetic-prod' }],
  ['empty inherited selector', selector, '', { CONVEX_DEPLOYMENT: '' }],
  ['different inherited dev', selector, '', { CONVEX_DEPLOYMENT: 'dev:synthetic-dev' }],
  ['production defaults selector', selector, 'CONVEX_DEPLOYMENT=prod:synthetic-prod', {}],
  ['duplicate defaults selector', selector, `${selector}\n${selector}`, {}],
] as const) test(`evaluation refuses ${label}`, () => {
  assert.throws(() => validateEvalDeployment(local, defaults, env));
});

for (const key of ['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY']) {
  for (const [label, local, defaults, env] of [
    ['local file', `${selector}\n${key}=synthetic-sensitive-value`, '', {}],
    ['defaults file', selector, `${key}=synthetic-sensitive-value`, {}],
    ['inherited value', selector, '', { [key]: 'synthetic-sensitive-value' }],
    ['empty inherited value', selector, '', { [key]: '' }],
  ] as const) test(`evaluation refuses ${key} in ${label} without echoing values`, () => {
    assert.throws(() => validateEvalDeployment(local, defaults, env), (error: Error) => {
      assert.ok(!error.message.includes('synthetic-sensitive-value'));
      return true;
    });
  });
}

test('evaluation fixture contract has exactly 17 positive, 3 adversarial and 8 held-out raw flags', () => {
  const [positive, adversarial, heldout] = [fixtures.slice(0, 17), fixtures.slice(17, 20), fixtures.slice(20)];
  assert.deepEqual(validateEvalFlags(positive, adversarial, heldout), fixtures);
  for (const [p, a, h] of [
    [fixtures.slice(0, 16), adversarial, heldout],
    [positive, fixtures.slice(18, 20), heldout],
    [positive, [fixtures[17], fixtures[17], fixtures[19]], heldout],
    [positive, adversarial, fixtures.slice(21)],
    [positive, adversarial, undefined],
    [positive, adversarial, [fixtures[0], ...fixtures.slice(21)]],
    [positive, [fixtures[17], fixtures[18], fixtures[20]], [fixtures[19], ...fixtures.slice(21)]],
    [[{ ...fixtures[0], extra: 'synthetic-hidden-field' }, ...fixtures.slice(1, 17)], adversarial, heldout],
    [[{ ...fixtures[0], entries: [{ ...fixtures[0].entries[0], amountPaise: 1.5 }] }, ...fixtures.slice(1, 17)], adversarial, heldout],
  ]) assert.throws(() => validateEvalFlags(p, a, h));
});

test('the frozen held-out fixture matches its recorded hash and covers the agreed shapes', () => {
  const text = readFileSync(fileURLToPath(new URL('../fixtures/m1-heldout.json', import.meta.url)), 'utf8');
  assert.equal(createHash('sha256').update(text).digest('hex'), HELDOUT_SHA256);
  const heldout = JSON.parse(text) as typeof fixtures;
  assert.deepEqual(heldout.map(flag => flag.flagKey), ['H33', 'H34', 'H35', 'H36', 'H37', 'H38', 'H39', 'H40']);
  // Retired sets are kept for the record, unchanged, and are never read by the runner.
  const runner = readFileSync(fileURLToPath(new URL('../../scripts/eval-m1.mjs', import.meta.url)), 'utf8');
  for (const [name, hash] of [
    ['m1-heldout-v1-retired', '4c8323a5594c6cb01a5d2f00666957c4e9e443297fbf650c9f8f8da4d05df4b9'],
    ['m1-heldout-v2-retired', '722ab01925c5620e0e3512b5e6d741e5d99401954e411dfa3ecc72c6bc650b25'],
    ['m1-heldout-v3-retired', '31fffaca21dd4815aa94c891ac5fe27ca876142629b7c9057b029261e9ad37dd'],
    ['m1-heldout-v4-retired', 'b9bd83eabfa312e90a50dbc55435088d365fa4b174cea4f96e04f71827b7bea8'],
  ]) {
    const retired = readFileSync(fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url)), 'utf8');
    assert.equal(createHash('sha256').update(retired).digest('hex'), hash);
    assert.ok(!runner.includes(`'tests/fixtures/${name}.json'`));
  }
  assert.deepEqual([...new Set(heldout.map(flag => flag.ruleId))].sort(), ['R1', 'R2', 'R3', 'R4', 'R5']);
  assert.ok(heldout.some(flag => flag.entries.length > 1));
  assert.ok(heldout.some(flag => new Set(flag.entries.map(entry => entry.party)).size > 1));
  assert.ok(heldout.some(flag => flag.entries.length > 10));
  // The real fixture files, not only synthetic stand-ins, pass the runner's contract.
  const real = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}.json`, import.meta.url)), 'utf8'));
  assert.equal(validateEvalFlags(real('m1-flags'), real('m1-adversarial'), heldout).length, 28);
});

for (const [label, selected, env, id] of [
  ['different cloud project', 'synthetic-cloud', {}, runId],
  ['inherited production selector', deployment, { CONVEX_DEPLOYMENT: 'prod:synthetic-prod' }, runId],
  ['alternate credential', deployment, { CONVEX_DEPLOY_KEY: 'synthetic-sensitive-key' }, runId],
  ['unsafe run identifier', deployment, {}, 'synthetic|unsafe'],
] as const) test(`runner refuses ${label} before any CLI process`, () => {
  let called = false;
  assert.throws(() => runEvalSteps(selected, fixtures, { env, runId: id, run: (() => { called = true; }) as never }));
  assert.equal(called, false);
});

test('offline evaluation orchestrates 84 sequential calls, one run id and exact pinned dev readback', () => {
  const { code, calls, messages, errors, reports } = runScenario();
  assert.equal(code, 0); assert.equal(calls.length, 86); assert.deepEqual(errors, []);
  assert.deepEqual(calls[0].args, ['--no-install', 'convex', 'dev', '--once']);
  for (let index = 1; index <= 84; index++) {
    assert.equal(calls[index].command, 'npx');
    assert.deepEqual(calls[index].args.slice(0, 6), ['--no-install', 'convex', 'run', '--deployment', deployment, 'ai:wordQuestion']);
    assert.deepEqual(JSON.parse(calls[index].args[6]), { flag: fixtures[Math.floor((index - 1) / 3)], runId, runNumber: ((index - 1) % 3) + 1 });
  }
  assert.deepEqual(calls[85].args, ['--no-install', 'convex', 'run', '--deployment', deployment, 'ai:questionsForRun', JSON.stringify({ runId })]);
  for (const { options } of calls) {
    assert.equal(options.env.CONVEX_DEPLOYMENT, `dev:${deployment}`);
    assert.equal(options.env.CONVEX_ALLOW_ANONYMOUS, 'false');
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    assert.equal(options.cwd, fileURLToPath(new URL('../../', import.meta.url)));
  }
  assert.equal(reports.length, 1);
  assert.deepEqual(messages.slice(-4), [
    'EVAL_M1 cases=20 runs=3 verified=60 rejected=0 blocked=0 failed=0 invented=0 all3_verified_cases=17',
    'EVAL_M1_AFTER_RETRY cases=20 runs=3 retries=0 verified=60 rejected=0 blocked=0 failed=0 invented=0 all3_verified_cases=17',
    'HELDOUT_M1 cases=8 runs=3 verified=24 rejected=0 blocked=0 failed=0 invented=0 all3_verified_cases=8',
    'HELDOUT_M1_AFTER_RETRY cases=8 runs=3 retries=0 verified=24 rejected=0 blocked=0 failed=0 invented=0 all3_verified_cases=8',
  ]);
  assert.ok(!JSON.stringify({ messages, errors, reports }).includes('synthetic-sensitive-cli'));
});

for (const index of [0, 1, 30, 84, 85]) test(`offline evaluation preserves exit code and stops at failing step ${index + 1}`, () => {
  const { code, calls, messages, errors, reports } = runScenario({ failAt: index, failureCode: 23 });
  assert.equal(code, 23); assert.equal(calls.length, index + 1); assert.equal(errors.length, 1);
  assert.equal(reports.length, 0); assert.ok(!messages.some(message => /^(?:EVAL|HELDOUT)_M1/.test(message)));
  assert.ok(!errors.join('\n').includes('synthetic-sensitive-cli'));
});

test('offline evaluation launch failures preserve no external error text', () => {
  const { code, calls, errors } = runScenario({ throwAt: 2 });
  assert.equal(code, 1); assert.equal(calls.length, 3); assert.equal(errors.length, 1);
  assert.ok(!errors.join('\n').includes('synthetic-sensitive-launch-error'));
});

test('offline evaluation handles signal failure without an exit code', () => {
  const messages: string[] = [], errors: string[] = [];
  const code = runEvalSteps(deployment, fixtures, {
    env: {}, runId, run: (() => ({ status: null, error: new Error('synthetic-sensitive-value') })) as never,
    log: (message: string) => messages.push(message), error: (message: string) => errors.push(message), writeArtifacts: () => {},
  });
  assert.equal(code, 1); assert.equal(messages.length, 1); assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('synthetic-sensitive-value'));
});

for (const [index, output] of ['not-json', 'null', '{}', JSON.stringify(makeRows().slice(1)), JSON.stringify([...makeRows(), makeRows()[0]])].entries()) {
  test(`offline evaluation refuses invalid readback ${index + 1} and writes no report`, () => {
    const { code, reports, messages } = runScenario({ output });
    assert.equal(code, 1); assert.equal(reports.length, 0);
    assert.ok(!messages.some(message => /^(?:EVAL|HELDOUT)_M1/.test(message)));
  });
}

test('readback rejects duplicate cases, other run ids, other rules, unknown statuses and invalid shapes', () => {
  for (const mutate of [
    (rows: StoredRow[]) => { rows[0].flagKey = rows[3].flagKey; },
    (rows: StoredRow[]) => { rows[0].runId = 'another-run'; },
    (rows: StoredRow[]) => { rows[0].ruleId = 'R2'; },
    (rows: StoredRow[]) => { rows[0].status = 'unknown'; },
    (rows: StoredRow[]) => { rows[0].inventedCount = -1; },
    (rows: StoredRow[]) => { rows[0].tokensIn = 1.5; },
    (rows: StoredRow[]) => { rows[0].quotes[0].field = 'unapproved'; },
    (rows: StoredRow[]) => { rows[0].evidenceIds = ['R2-UDYAM']; },
    (rows: StoredRow[]) => { rows[0].evidenceIds = ['R1-LOAN-AGREEMENT', 'R1-LOAN-AGREEMENT']; },
  ]) {
    const rows = makeRows(); mutate(rows);
    assert.throws(() => buildEvalReport(fixtures, rows, runId));
  }
});

test('report counters cover all statuses and only positive cases count toward the 15-of-17 gate', () => {
  const rows = makeRows();
  rows[0].status = 'rejected'; rows[0].inventedCount = 2; rows[0].reasons = ['invented_number'];
  rows[1].status = 'failed'; rows[2].status = 'disabled';
  rows[3].status = 'cap_hit';
  for (let index = 51; index <= 53; index++) { rows[index].status = 'blocked_injection'; rows[index].reasons = ['injection_instruction']; }
  const report = buildEvalReport(fixtures, [...rows].reverse(), runId);
  assert.deepEqual(report.json.summary, {
    cases: 20, positiveCases: 17, adversarialCases: 3, runs: 3, verified: 53, rejected: 1, blocked: 3, failed: 3, invented: 2, all3VerifiedCases: 15,
    afterRetry: { retries: 0, verified: 53, rejected: 1, blocked: 3, failed: 3, invented: 2, all3VerifiedCases: 15 },
    heldout: {
      cases: 8, runs: 3, verified: 24, rejected: 0, blocked: 0, failed: 0, invented: 0, all3VerifiedCases: 8,
      afterRetry: { retries: 0, verified: 24, rejected: 0, blocked: 0, failed: 0, invented: 0, all3VerifiedCases: 8 },
    },
  });
  assert.equal(report.line, 'EVAL_M1 cases=20 runs=3 verified=53 rejected=1 blocked=3 failed=3 invented=2 all3_verified_cases=15');
  assert.deepEqual(report.json.rows.slice(0, 3).map((row: any) => row.run), [1, 2, 3]);
  assert.deepEqual(report.json.rows.slice(0, 3).map((row: any) => row.status), ['rejected', 'failed', 'disabled']);
  assert.equal(report.markdown.split('\n').filter((line: string) => line.startsWith('|')).length, 88);
  assert.match(report.markdown, /Loan agreement or letter stating terms/);
  assert.match(report.markdown, /only the 17 planted positive cases/);
  assert.match(report.markdown, /## Held-out set v5 \(frozen 20 Oct 2026/);
});

test('held-out results are reported on their own line and never change the development line', () => {
  const rows = makeRows();
  rows[60].status = 'rejected'; rows[60].inventedCount = 1;
  rows[83].status = 'failed';
  const report = buildEvalReport(fixtures, rows, runId);
  assert.equal(report.line, 'EVAL_M1 cases=20 runs=3 verified=60 rejected=0 blocked=0 failed=0 invented=0 all3_verified_cases=17');
  assert.equal(report.heldoutLine, 'HELDOUT_M1 cases=8 runs=3 verified=22 rejected=1 blocked=0 failed=1 invented=1 all3_verified_cases=6');
  assert.deepEqual([...new Set(report.json.rows.map((row: any) => `${row.case[0]}:${row.set}`))].sort(), ['A:dev', 'H:heldout', 'P:dev']);
});

function retryOf(row: StoredRow, changes: Partial<StoredRow> = {}): StoredRow {
  return { ...structuredClone(row), _id: `${row._id}-retry`, attempt: 2, status: 'verified', reasons: [], inventedCount: 0, createdAt: row.createdAt + 1000, ...changes };
}

test('a retry pairs with its rejected first try: pass marks stay on first tries, after-retry is extra', () => {
  const rows = makeRows();
  rows[0].status = 'rejected'; rows[0].reasons = ['QUESTION_SENTENCE_COUNT'];
  rows[4].status = 'rejected'; rows[4].reasons = ['QUESTION_SENTENCE_COUNT'];
  rows[61].status = 'rejected'; rows[61].reasons = ['QUOTE_COUNT'];
  const retries = [retryOf(rows[0]), retryOf(rows[4], { status: 'rejected', reasons: ['QUESTION_SENTENCE_COUNT'], inventedCount: 1 }), retryOf(rows[61], { status: 'failed', reasons: ['AI_CALL_FAILED'] })];
  const report = buildEvalReport(fixtures, [...retries, ...rows], runId);
  assert.equal(report.line, 'EVAL_M1 cases=20 runs=3 verified=58 rejected=2 blocked=0 failed=0 invented=0 all3_verified_cases=15');
  assert.equal(report.retryLine, 'EVAL_M1_AFTER_RETRY cases=20 runs=3 retries=2 verified=59 rejected=1 blocked=0 failed=0 invented=1 all3_verified_cases=16');
  assert.equal(report.heldoutLine, 'HELDOUT_M1 cases=8 runs=3 verified=23 rejected=1 blocked=0 failed=0 invented=0 all3_verified_cases=7');
  // A retry with no reply never replaces the first try.
  assert.equal(report.heldoutRetryLine, 'HELDOUT_M1_AFTER_RETRY cases=8 runs=3 retries=1 verified=23 rejected=1 blocked=0 failed=0 invented=0 all3_verified_cases=7');
  assert.deepEqual(report.json.rows.slice(0, 2).map((row: any) => [row.run, row.attempt, row.status]), [[1, 1, 'rejected'], [1, 2, 'verified']]);
  assert.match(report.markdown, /\| case \| rule \| run \| attempt \|/);
  assert.match(report.markdown, /judged on the first-try line/);
});

test('readback refuses unpaired, duplicate or misplaced retries and missing run numbers', () => {
  for (const mutate of [
    (rows: StoredRow[]) => [...rows, retryOf(rows[0])],
    (rows: StoredRow[]) => { rows[0].status = 'rejected'; return [...rows, retryOf(rows[0]), retryOf(rows[0], { _id: 'second-retry' })]; },
    (rows: StoredRow[]) => { rows[1].runNumber = 1; return rows; },
    (rows: StoredRow[]) => { rows[0].runNumber = 4; return rows; },
    (rows: StoredRow[]) => { rows[0].attempt = 3; return rows; },
    (rows: StoredRow[]) => { delete (rows[0] as Partial<StoredRow>).runNumber; return rows; },
    (rows: StoredRow[]) => rows.slice(1),
  ]) assert.throws(() => buildEvalReport(fixtures, mutate(makeRows()), runId));
});

test('reports escape Markdown pipes and line breaks and discard unknown provider fields', () => {
  const rows = makeRows();
  rows[0].questionText = 'Which terms | dates\napply?';
  rows[0].reasons = ['example|reason\ncontinued'];
  Object.assign(rows[0], { unexpectedProviderMetadata: 'synthetic-sensitive-provider-value' });
  const report = buildEvalReport(fixtures, rows, runId);
  assert.match(report.markdown, /Which terms \\\| dates apply\?/);
  assert.match(report.markdown, /example\\\|reason continued/);
  assert.ok(!JSON.stringify(report).includes('synthetic-sensitive-provider-value'));
});

test('artifact write failure prevents the final evaluation result line', () => {
  const { code, errors, messages } = runScenario({ artifactFails: true });
  assert.equal(code, 1); assert.equal(errors.length, 1);
  assert.ok(!messages.some(message => /^(?:EVAL|HELDOUT)_M1/.test(message)));
  assert.ok(!errors[0].includes('synthetic-sensitive-write-error'));
});

test('main refuses unsafe settings before the process runner and never prints configuration values', () => {
  let called = false;
  const errors: string[] = [];
  const code = main({
    read: ((path: string) => path.endsWith('.env.local') ? `${selector}\nCONVEX_DEPLOY_KEY=synthetic-sensitive-key` : '') as never,
    env: {}, run: (() => { called = true; }) as never, log: () => {}, error: (message: string) => errors.push(message),
  });
  assert.equal(code, 1); assert.equal(called, false); assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('synthetic-sensitive-key'));
});

test('main reads fixtures only after safe selectors and handles absent default configuration', () => {
  const reads: string[] = [];
  const read = (path: string) => {
    reads.push(path);
    if (path.endsWith('.env.local')) return selector;
    if (path.endsWith('.env')) throw Object.assign(new Error('synthetic-sensitive-file-error'), { code: 'ENOENT' });
    if (path.endsWith('m1-flags.json')) return JSON.stringify(fixtures.slice(0, 17));
    if (path.endsWith('m1-adversarial.json')) return JSON.stringify(fixtures.slice(17, 20));
    if (path.endsWith('m1-heldout.json')) return heldoutText;
    throw new Error('unexpected offline read');
  };
  let callCount = 0;
  const code = main({
    read: read as never, env: {}, runId, heldoutSha256: heldoutHash,
    run: (() => ({ status: 0, stdout: ++callCount === 86 ? JSON.stringify(makeRows()) : '' })) as never,
    log: () => {}, error: () => {}, writeArtifacts: () => {},
  });
  assert.equal(code, 0); assert.equal(callCount, 86); assert.equal(reads.length, 5);
});

test('main refuses a changed held-out set before the process runner', () => {
  let called = false;
  const errors: string[] = [];
  const code = main({
    read: ((path: string) => path.endsWith('.env.local') ? selector
      : path.endsWith('m1-flags.json') ? JSON.stringify(fixtures.slice(0, 17))
        : path.endsWith('m1-adversarial.json') ? JSON.stringify(fixtures.slice(17, 20))
          : path.endsWith('m1-heldout.json') ? `${heldoutText} ` : '') as never,
    env: {}, heldoutSha256: heldoutHash, run: (() => { called = true; }) as never, log: () => {}, error: (message: string) => errors.push(message),
  });
  assert.equal(code, 1); assert.equal(called, false);
  assert.deepEqual(errors, ['Evaluation refused: the frozen held-out set has changed.']);
});

test('importing the evaluation module alone never starts the runner', () => {
  const modulePath = fileURLToPath(new URL('../../scripts/eval-m1.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `await import(${JSON.stringify(modulePath)});`], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', CONVEX_DEPLOYMENT: 'prod:synthetic-should-never-be-inspected' },
  });
  assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});

test('every run is archived with a dated copy and a summary appended to the eval log', () => {
  const writes: string[] = [], flags: unknown[] = [], appends: { path: string; text: string }[] = [];
  const report = buildEvalReport(fixtures, makeRows(), runId);
  assert.equal(istStamp(Date.parse('2026-10-16T13:20:00Z')), '2026-10-16_1850');
  const base = archiveRun(report, { now: Date.parse('2026-10-16T13:20:00Z'), directory: '/synthetic',
    write: ((path: string, _text: string, options: { flag?: string }) => { writes.push(path); flags.push(options?.flag); }) as never, append: ((path: string, text: string) => { appends.push({ path, text }); }) as never, mkdir: (() => {}) as never });
  assert.equal(base, '2026-10-16_1850_m1-offline-test');
  assert.deepEqual(writes, ['/synthetic/runs/2026-10-16_1850_m1-offline-test.json', '/synthetic/runs/2026-10-16_1850_m1-offline-test.md']);
  // An existing archive is never overwritten.
  assert.deepEqual(flags, ['wx', 'wx']);
  assert.equal(appends.length, 1); assert.equal(appends[0].path, '/synthetic/eval-log.md');
  for (const line of report.lines) assert.ok(appends[0].text.includes(line));
  assert.match(appends[0].text, /## Run 2026-10-16 1850 IST — m1-offline-test \(auto-logged\)/);
});

test('pilot cases are parsed strictly: development keys only, 1 to 6, no duplicates', () => {
  assert.equal(parsePilot([]), undefined);
  assert.deepEqual(parsePilot(['--pilot=P5,P6,P7,P8']), ['P5', 'P6', 'P7', 'P8']);
  for (const bad of ['--pilot=', '--pilot=H17', '--pilot=A1-INJECTION', '--pilot=P5,P5', '--pilot=P1,P2,P3,P4,P5,P6,P7']) {
    assert.throws(() => parsePilot([bad]), /Evaluation refused/, bad);
  }
});

test('a pilot runs only its development cases, is never scored and never overwrites eval.md', () => {
  const pilotFlags = fixtures.slice(4, 8);
  const rows = makeRows().filter(row => pilotFlags.some(flag => flag.flagKey === row.flagKey));
  rows[0].status = 'rejected'; rows[0].reasons = ['QUESTION_SENTENCE_COUNT'];
  const calls: string[][] = [], logs: string[] = [], reports: any[] = [];
  const code = runEvalSteps(deployment, pilotFlags, {
    pilot: true, env: {}, runId, log: (message: string) => logs.push(message), error: () => {},
    run: ((command: string, args: string[]) => { calls.push(args); return { status: 0, stdout: calls.length === 14 ? JSON.stringify(rows) : '' }; }) as never,
    writeArtifacts: (report: any) => reports.push(report),
  });
  assert.equal(code, 0); assert.equal(calls.length, 14);
  assert.equal(reports.length, 1); assert.equal(reports[0].json.pilot, true);
  assert.equal(logs.at(-1), 'PILOT_M1 cases=4 runs=3 verified=11 rejected=1 blocked=0 failed=0 invented=0 all3_verified_cases=3 retries=0 two_part_answers=1 answers=12');
  assert.ok(!logs.some(message => /^(?:EVAL|HELDOUT)_M1/.test(message)));
  assert.match(reports[0].markdown, /not scored against the pass marks/);
  for (const flags of [[...pilotFlags, fixtures[20]], fixtures.slice(0, 7), []]) {
    assert.throws(() => runEvalSteps(deployment, flags, { pilot: true, env: {}, runId, run: (() => { throw new Error('must not run'); }) as never }));
  }
});

test('main runs only the named pilot cases and refuses keys that are not development cases', () => {
  const read = (path: string) => path.endsWith('.env.local') ? selector
    : path.endsWith('m1-flags.json') ? JSON.stringify(fixtures.slice(0, 17))
      : path.endsWith('m1-adversarial.json') ? JSON.stringify(fixtures.slice(17, 20))
        : path.endsWith('m1-heldout.json') ? heldoutText : (() => { throw Object.assign(new Error('absent'), { code: 'ENOENT' }); })();
  const pilotRows = makeRows().filter(row => ['P05', 'P08'].includes(row.flagKey));
  const attempt = (argv: string[]) => {
    const sent: string[][] = [], logs: string[] = [];
    const code = main({ read: read as never, env: {}, runId, heldoutSha256: heldoutHash, argv,
      run: ((command: string, args: string[]) => { sent.push(args); return { status: 0, stdout: JSON.stringify(pilotRows) }; }) as never,
      log: (message: string) => logs.push(message), error: () => {}, writeArtifacts: () => {} });
    return { code, sent, logs };
  };
  const ok = attempt(['--pilot=P05,P08']);
  assert.equal(ok.code, 0); assert.equal(ok.sent.length, 8);
  assert.deepEqual(ok.sent.slice(1, 7).map(args => JSON.parse(args[6]).flag.flagKey), ['P05', 'P05', 'P05', 'P08', 'P08', 'P08']);
  assert.match(ok.logs.at(-1)!, /^PILOT_M1 cases=2 /);
  const refused = attempt(['--pilot=P99']);
  assert.equal(refused.code, 1); assert.equal(refused.sent.length, 0);
});
