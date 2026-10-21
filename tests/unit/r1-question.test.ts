import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedR1Question, R1_FOLLOWUPS, R1_NATURE_BUTTONS } from '../../shared/r1-question.ts';
import { NATURE_OPTIONS, COUNTERPARTY_OPTIONS, TERM_OPTIONS } from '../../shared/outcomes.ts';
import { QUESTION_GOALS } from '../../shared/routing.ts';
import { buildFlagInput, type RawFlag } from '../../shared/flag-input.ts';
import { verifyReply } from '../../shared/verify.ts';

const entry = (date: string, amountPaise: number, narration = 'temporary funds from MD') => ({ date, party: 'Rajesh Mehta', narration, amountPaise, voucherNo: 'NF-1', lineNo: 1 });
const flag = (entries: ReturnType<typeof entry>[]): RawFlag => ({ flagKey: 'R1:Rajesh Mehta', ruleId: 'R1', ledgerName: 'Rajesh Mehta', tallyGroup: 'Sundry Creditors', entries });
const rajesh = flag([entry('2025-04-05T00:00:00+05:30', 10_00_00_000_00 / 10), entry('2025-05-05T00:00:00+05:30', 10_00_00_000_00 / 10), entry('2025-06-05T00:00:00+05:30', 5_00_00_000_00 / 10)]);

test('Rajesh Mehta: context line then one open question, count, total, plain dates and the narration quoted', () => {
  const q = fixedR1Question(rajesh);
  assert.equal(q.context, "The books show 3 receipts from the bank into Rajesh Mehta's account, totalling ₹2,50,00,000, between 5 April 2025 and 5 June 2025. The narration reads 'temporary funds from MD'.");
  assert.equal(q.question, 'What was this money received for?');
  assert.equal(q.text, `${q.context} ${q.question}`);
});

test('single receipt uses one date and the singular', () => {
  const q = fixedR1Question(flag([entry('2025-04-05T00:00:00+05:30', 5_00_000_00)]));
  assert.ok(q.context.startsWith('The books show 1 receipt from the bank into Rajesh Mehta\'s account, totalling ₹5,00,000, on 5 April 2025.'));
});

test('different narrations: up to two are quoted, in date order', () => {
  const q = fixedR1Question(flag([entry('2025-04-05T00:00:00+05:30', 1_00_000_00, 'loan recd'), entry('2025-05-05T00:00:00+05:30', 1_00_000_00, 'for working capital')]));
  assert.ok(q.context.includes("The narrations read 'loan recd' and 'for working capital'."));
});

test('the fixed question never uses the words loan, advance, deposit or any treatment word, except inside a quoted narration', () => {
  const q = fixedR1Question(flag([entry('2025-04-05T00:00:00+05:30', 1_00_000_00, 'funds')]));
  assert.doesNotMatch(q.text, /\b(loan|advance|deposit|reclass|borrowing|payable)\b/i);
});

test('the code-written question passes the AI checker too (R1 allows a context line, ruling #33)', () => {
  const q = fixedR1Question(rajesh);
  const raw = JSON.stringify({ question: q.text, evidenceIds: ['R1-BANK-STATEMENT'], quotes: [{ field: 'narration', text: 'temporary funds from MD' }] });
  const result = verifyReply(raw, buildFlagInput(rajesh), ['Rajesh Mehta']);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.status, 'verified');
});

test('R1 answer buttons are the approved options and live in the answer, not in the AI input or the question', () => {
  assert.deepEqual(R1_NATURE_BUTTONS.map(b => b.value), [...NATURE_OPTIONS]);
  assert.equal(R1_NATURE_BUTTONS[0].label, 'Goods or services supplied');
  assert.deepEqual(buildFlagInput(rajesh).theme.options, []);
});

test('follow-ups are three short questions with their own buttons, the third for a director or relative only', () => {
  assert.deepEqual(R1_FOLLOWUPS.map(f => f.id), ['counterparty', 'term', 'declaration']);
  assert.equal(R1_FOLLOWUPS[0].question, 'Who provided the money?');
  assert.deepEqual(R1_FOLLOWUPS[0].buttons.map(b => b.value), [...COUNTERPARTY_OPTIONS]);
  assert.equal(R1_FOLLOWUPS[1].question, 'When is it to be repaid?');
  assert.deepEqual(R1_FOLLOWUPS[1].buttons.map(b => b.value), [...TERM_OPTIONS]);
  assert.deepEqual(R1_FOLLOWUPS[2].buttons.map(b => b.value), ['yes', 'no', 'unknown']);
  assert.deepEqual(R1_FOLLOWUPS.map(f => f.onlyFor ?? null), [null, null, ['director', 'relative']]);
  for (const f of R1_FOLLOWUPS) assert.equal(f.question.split('?').length, 2); // exactly one question mark
});

test('the R1 goal asks one open question and bans the answer words', () => {
  assert.match(QUESTION_GOALS.R1, /^What was the money received for\?/);
  assert.match(QUESTION_GOALS.R1, /loan, advance or deposit/);
});

test('refuses an empty flag', () => {
  assert.throws(() => fixedR1Question(flag([])));
});
