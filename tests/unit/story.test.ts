import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { fakeDb } from '../helpers/fake-db.ts';
import { loadSeedData } from '../../scripts/seed-data.ts';
import { companyFigures, storyBoard } from '../../convex/storyCore.ts';
import { decisionSnapshot } from '../../shared/decision.ts';
import { r2Snapshot } from '../../shared/r2-outcome.ts';
import { r3Snapshot } from '../../shared/r3-outcome.ts';
import { caseLine, nextStep, rbiLine, rbiMessage, STORY_CASES, type StoryBoard } from '../../shared/story.ts';
import { refusalText } from '../../src/gap-detail-logic.ts';
import { parseRoute, playAgain, readSession, saveSession, clearSession } from '../../src/story-session.ts';
import { Briefing, CaseBoard, CompanyPage, Debrief, Meters, NextCase } from '../../src/Story.tsx';
import { GapDetailPage } from '../../src/GapDetail.tsx';
import { TermLoanDetailPage } from '../../src/TermLoanDetail.tsx';

const NOW = Date.UTC(2026, 9, 21, 10, 28, 0); // 3:58 pm IST
const DAY = 86_400_000;
beforeEach(() => mock.timers.enable({ apis: ['Date'], now: NOW }));
afterEach(() => mock.timers.reset());

const seed = await loadSeedData('.');
const books = { data: { ...seed, company: seed.company }, covenants: { debtEquity: seed.company.covenantThresholds.debtEquity, currentRatio: seed.company.covenantThresholds.currentRatio } } as never;
const S = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
const flags = [
  { flagKey: 'R1:Rajesh Mehta', ruleId: 'R1', party: 'Rajesh Mehta', ledger: 'Rajesh Mehta', amount: 2_50_00_000_00 },
  { flagKey: 'R2:Delta Rubber', ruleId: 'R2', party: 'Delta Rubber', ledger: 'Delta Rubber', amount: 8_00_000_00 },
  { flagKey: 'R3:Meridian Co-operative Bank Term Loan', ruleId: 'R3', party: 'Meridian Co-operative Bank', ledger: 'Meridian Co-operative Bank Term Loan', amount: 9_60_00_000_00 },
];
const session = (sessionId: string, expiresAt = NOW + 7 * DAY) => ({ sessionId, codeHash: 'h', createdAt: NOW, expiresAt, saveHour: 0, saves: 0 });
const r1Reclass = decisionSnapshot({ nature: 'loan', counterparty: 'director', term: 'within_12_months', declaration: 'yes' }, { ledger: 'Rajesh Mehta', amount: 2_50_00_000_00, related: true }, seed.ledgers, seed.entries, 1.5);
const r3Split = r3Snapshot({ documents: 'both' }, seed as never, 'Meridian Co-operative Bank Term Loan', 1.2);
const r2Due = r2Snapshot({ certificate: 'yes', size: 'small', terms: 'none' }, seed as never, 'Delta Rubber', { value: 5.75, date: '2026-10-21', sourceUrl: 'https://www.rbi.org.in/' });
const decided = (table: string, flagKey: string, decision: 'approved' | 'sent_back', snapshot: unknown, sessionId?: string) => ({ ...(sessionId ? { sessionId } : {}), flagKey, decision, decidedAt: 5, snapshot });
const answered = (flagKey: string, sessionId?: string) => ({ ...(sessionId ? { sessionId } : {}), flagKey, answeredAt: 1 });
const board = (seedRows: Record<string, Record<string, unknown>[]>, sessionId = S) => storyBoard({ db: fakeDb({ flag: flags, visitorSession: [session(S)], ...seedRows }).db }, sessionId, books);
const card = (b: StoryBoard, ruleId: string) => b.cases.find(c => c.ruleId === ruleId)!;

test('registry: the three fixed cases with their titles and tables', () => {
  assert.deepEqual(STORY_CASES.map(c => [c.flagKey, c.title, c.answerTable, c.outcomeTable]), [
    ['R1:Rajesh Mehta', 'Whose money is this?', 'answer', 'outcome'],
    ['R2:Delta Rubber', 'Did we pay a small supplier late?', 'msmeAnswer', 'msmeOutcome'],
    ['R3:Meridian Co-operative Bank Term Loan', 'How much of this loan is due this year?', 'termLoanAnswer', 'termLoanOutcome'],
  ]);
});

test('a new session: every case open, meters at the booked 1.40 and 1.23', async () => {
  const b = await board({});
  assert.deepEqual(b.session, { exists: true, expired: false });
  assert.deepEqual(b.cases.map(c => [c.ruleId, c.party, c.amount, c.status, c.decidedAt, c.line]), [
    ['R1', 'Rajesh Mehta', 2_50_00_000_00, 'open', null, null],
    ['R2', 'Delta Rubber', 8_00_000_00, 'open', null, null],
    ['R3', 'Meridian Co-operative Bank', 9_60_00_000_00, 'open', null, null],
  ]);
  assert.equal(b.meters.debtEquity.booked.toFixed(2), '1.40');
  assert.equal(b.meters.debtEquity.now, b.meters.debtEquity.booked);
  assert.equal(b.meters.debtEquity.limit, 1.5);
  assert.equal(b.meters.currentRatio.booked.toFixed(2), '1.23');
  assert.equal(b.meters.currentRatio.now, b.meters.currentRatio.booked);
  assert.equal(b.meters.currentRatio.floor, 1.2);
});

test('an answer without a decision is Answered', async () => {
  const b = await board({ msmeAnswer: [answered('R2:Delta Rubber', S)] });
  assert.equal(card(b, 'R2').status, 'answered');
});

test('approving Rajesh as a reclass moves debt-equity to 1.57 and says it breaks', async () => {
  const b = await board({ answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass, S)] });
  const r1 = card(b, 'R1');
  assert.equal(r1.status, 'approved');
  assert.equal(r1.decidedAt, 5);
  assert.equal(b.meters.debtEquity.now.toFixed(2), '1.57');
  assert.equal(b.meters.currentRatio.now, b.meters.currentRatio.booked);
  assert.deepEqual(r1.line, { entry: 'Move ₹2,50,00,000 from trade payables to short-term borrowings.', effect: 'Debt-equity 1.40 → 1.57 against the 1.50 limit: breaks' });
});

test('approving the Meridian split moves the current ratio to 1.14 and says it breaks', async () => {
  const b = await board({ termLoanAnswer: [answered('R3:Meridian Co-operative Bank Term Loan', S)], termLoanOutcome: [decided('termLoanOutcome', 'R3:Meridian Co-operative Bank Term Loan', 'approved', r3Split, S)] });
  assert.equal(b.meters.currentRatio.now.toFixed(2), '1.14');
  assert.equal(b.meters.debtEquity.now, b.meters.debtEquity.booked);
  assert.deepEqual(card(b, 'R3').line, { entry: 'Move ₹2,40,00,000 due within 12 months to current liabilities.', effect: 'Current ratio 1.23 → 1.14 against the 1.20 floor: breaks' });
});

const r1Long = decisionSnapshot({ nature: 'loan', counterparty: 'director', term: 'after_12_months', declaration: 'yes' }, { ledger: 'Rajesh Mehta', amount: 2_50_00_000_00, related: true }, seed.ledgers, seed.entries, 1.5);

test('a long-term Rajesh loan leaves current liabilities: the sentence says long-term and the current ratio rises to 1.34', async () => {
  const b = await board({ answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Long, S)] });
  assert.equal(b.meters.debtEquity.now.toFixed(2), '1.57');
  assert.equal(b.meters.currentRatio.now.toFixed(2), '1.34');
  assert.deepEqual(card(b, 'R1').line, { entry: 'Move ₹2,50,00,000 from trade payables to long-term borrowings.', effect: 'Debt-equity 1.40 → 1.57 against the 1.50 limit: breaks; current ratio 1.23 → 1.34 against the 1.20 floor: holds' });
});

test('long-term Rajesh plus the Meridian split: both move current liabilities, so the current ratio ends at 1.23 and holds', async () => {
  const b = await board({ answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Long, S)],
    termLoanAnswer: [answered('R3:Meridian Co-operative Bank Term Loan', S)], termLoanOutcome: [decided('termLoanOutcome', 'R3:Meridian Co-operative Bank Term Loan', 'approved', r3Split, S)] });
  assert.equal(b.meters.currentRatio.now.toFixed(2), '1.23');
  assert.equal(b.meters.currentRatio.now >= b.meters.currentRatio.floor, true);
  assert.equal(card(b, 'R3').line!.effect, 'Current ratio 1.34 → 1.23 against the 1.20 floor: holds');
});

test('sending back changes no meter and claims no entry', async () => {
  const b = await board({ answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'sent_back', r1Reclass, S)] });
  assert.equal(card(b, 'R1').status, 'sent_back');
  assert.equal(card(b, 'R1').line, null);
  assert.equal(b.meters.debtEquity.now, b.meters.debtEquity.booked);
});

test("another visitor's rows and the dev rows never count", async () => {
  const b = await board({
    visitorSession: [session(S), session(OTHER)],
    answer: [answered('R1:Rajesh Mehta', OTHER), answered('R1:Rajesh Mehta')],
    outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass, OTHER), decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass)],
    termLoanOutcome: [decided('termLoanOutcome', 'R3:Meridian Co-operative Bank Term Loan', 'approved', r3Split, OTHER)],
  });
  assert.deepEqual(b.cases.map(c => c.status), ['open', 'open', 'open']);
  assert.equal(b.meters.debtEquity.now, b.meters.debtEquity.booked);
  assert.equal(b.meters.currentRatio.now, b.meters.currentRatio.booked);
});

test('a missing flag still shows its card, open and without an amount', async () => {
  const b = await storyBoard({ db: fakeDb({ flag: flags.slice(0, 2), visitorSession: [session(S)] }).db }, S, books);
  assert.equal(b.cases.length, 3);
  assert.deepEqual([card(b, 'R3').status, card(b, 'R3').amount, card(b, 'R3').party, card(b, 'R3').title], ['open', null, null, 'How much of this loan is due this year?']);
});

test('the board reports a missing or expired session', async () => {
  assert.deepEqual((await board({}, OTHER)).session, { exists: false, expired: false });
  const expired = await storyBoard({ db: fakeDb({ flag: flags, visitorSession: [session(S, NOW - 1)] }).db }, S, books);
  assert.deepEqual(expired.session, { exists: true, expired: true });
});

test('caseLine: R2 interest is indicative and has no covenant effect; other outcomes give the plain note only', () => {
  assert.equal(r2Due.kind, 'interest_due');
  assert.deepEqual(caseLine('R2', r2Due), { entry: `Indicative MSMED interest of ₹${(r2Due.interest! / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`, effect: 'No covenant effect' });
  const none = r2Snapshot({ certificate: 'not_registered', terms: 'none' }, seed as never, 'Delta Rubber', null);
  assert.deepEqual(caseLine('R2', none), { entry: null, effect: none.notes[0] });
  const stays = decisionSnapshot({ nature: 'goods_services' } as never, { ledger: 'Rajesh Mehta', amount: 2_50_00_000_00 }, seed.ledgers, seed.entries, 1.5);
  assert.deepEqual(caseLine('R1', stays), { entry: null, effect: 'No change. It stays a trade payable.' });
});

test('convex story:board is a public query on a string session id that loads the books and the board', async () => {
  const text = await readFile('convex/story.ts', 'utf8');
  assert.match(text, /export const board = query\(\{ args: \{ sessionId: v\.string\(\) \}/);
  assert.match(text, /storyBoard\(ctx, sessionId, await loadBooks\(ctx\)\)/);
  assert.doesNotMatch(await readFile('convex/storyCore.ts', 'utf8'), /codeHash/);
});

test('story refusals use sign-off words; dev refusals are unchanged', () => {
  assert.equal(refusalText('wrong', true), 'That sign-off code is wrong.');
  assert.equal(refusalText('wrong'), 'That passcode is wrong.');
  for (const r of ['no_session', 'expired']) assert.equal(refusalText(r, true), 'This session has ended. Start a new one.');
  assert.equal(refusalText('slow_down', true), "You've saved a lot this hour. Try again in a few minutes.");
  assert.equal(refusalText('busy', true), 'The demo has reached today\'s limit. Try again tomorrow.');
  assert.match(refusalText('locked', true), /locked until the next hour/);
});

const rate = { value: 5.75, date: '2026-10-21', sourceUrl: 'https://www.rbi.org.in/', checkedAt: NOW, lastDecision: '2026-10-07', next: { start: '2026-12-02', end: '2026-12-04' } };
test('RBI line: checked time in IST, the Bank Rate and the next scheduled change', () => {
  assert.equal(rbiLine(rate), 'Last checked 21 Oct 2026, 3:58 pm IST · Bank Rate 5.75% · Next scheduled change: 4 December 2026');
  assert.equal(rbiLine({ ...rate, checkedAt: null, next: null }), 'Last checked 21 Oct 2026 · Bank Rate 5.75% · No meeting schedule on file');
  assert.equal(rbiLine({ ...rate, next: null, scheduleFy: '2026-27' }).endsWith("No further meeting in RBI's 2026-27 schedule"), true);
  assert.equal(rbiLine({ ...rate, checkedAt: Date.UTC(2026, 9, 20, 18, 35) }), 'Last checked 21 Oct 2026, 12:05 am IST · Bank Rate 5.75% · Next scheduled change: 4 December 2026');
});

test('RBI messages per status, word for word', () => {
  assert.equal(rbiMessage('cached', rate), 'Already up to date (checked 3:58 pm)');
  assert.equal(rbiMessage('limit', rate), "You've checked 3 times today. The rate can only change at an RBI decision.");
  assert.equal(rbiMessage('failed', rate), "Couldn't read RBI's site. Showing the rate from 21 Oct 2026.");
  assert.equal(rbiMessage('busy', rate), "The demo has reached today's limit. Try again tomorrow.");
  assert.equal(rbiMessage('fresh', rate), 'Updated from rbi.org.in.');
  assert.equal(rbiMessage('expired', rate), 'This session has ended. Start a new one.');
});

test('routes: story paths, and the public build opens on the story', () => {
  assert.deepEqual(parseRoute('#/story', false), { kind: 'story' });
  assert.deepEqual(parseRoute('#/story/case/R1%3ARajesh%20Mehta', false), { kind: 'case', flagKey: 'R1:Rajesh Mehta' });
  assert.deepEqual(parseRoute('#/story/debrief', false), { kind: 'debrief' });
  assert.deepEqual(parseRoute('#/gap/R2%3ADelta%20Rubber', false), { kind: 'gap', flagKey: 'R2:Delta Rubber' });
  assert.deepEqual(parseRoute('', false), { kind: 'home' });
  assert.deepEqual(parseRoute('#/', false), { kind: 'home' });
  assert.deepEqual(parseRoute('', true), { kind: 'story' });
  assert.deepEqual(parseRoute('#/', true), { kind: 'story' });
});

test('session id: kept in sessionStorage, and storage that throws never breaks the page', () => {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  assert.equal(readSession(), null);
  saveSession(S);
  assert.equal(store.get('nf-story-session'), S);
  assert.equal(readSession(), S);
  clearSession();
  assert.equal(readSession(), null);
  (globalThis as Record<string, unknown>).sessionStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(readSession(), null);
  assert.doesNotThrow(() => saveSession(S));
  assert.doesNotThrow(() => clearSession());
  delete (globalThis as Record<string, unknown>).sessionStorage;
  assert.equal(readSession(), null);
});

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/&#x27;/g, "'");
const fresh = (b: StoryBoard) => b;
test('briefing: the chosen words, booked meters, preview cards, and Start disabled until a 4 to 20 character code', async () => {
  const b = fresh(await storyBoard({ db: fakeDb({ flag: flags }).db }, '', books));
  const props = { board: b, code: '', busy: false, message: '', onCode: () => {}, onStart: () => {} };
  const out = html(createElement(Briefing, props));
  for (const words of ['Your first week as controller.', "Northfield's books close for audit soon. Three entries look wrong. Find out what they are, decide, and see what each answer does to the loan covenants.", 'Pick a sign-off code.', "You'll enter it each time you approve something, the way a controller signs off. It stays in this browser session and is never shared. Any 4 to 20 characters.", 'Start the clock', 'Whose money is this?', '₹2.5 crore', 'Rajesh Mehta', 'Did we pay a small supplier late?', '₹8 lakh', 'How much of this loan is due this year?', '₹9.6 crore', 'Meridian Co-operative Bank', 'Synthetic company and data. Nothing here is advice.']) assert.ok(out.includes(words), words);
  assert.doesNotMatch(out, /href="#\/story\/case/);
  assert.match(out, /type="password"/);
  const start = (code: string) => html(createElement(Briefing, { ...props, code })).match(/<button[^>]*>Start the clock/)![0];
  assert.match(start(''), /disabled/);
  assert.match(start('abc'), /disabled/);
  assert.doesNotMatch(start('abcd'), /disabled/);
  assert.doesNotMatch(start('a'.repeat(20)), /disabled/);
  assert.match(start('a'.repeat(21)), /disabled/);
});

test('board: three linked cards with the status word on every chip, meters, and a debrief link', async () => {
  const b = await board({ msmeAnswer: [answered('R2:Delta Rubber', S)], answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass, S)], termLoanAnswer: [answered('R3:Meridian Co-operative Bank Term Loan', S)], termLoanOutcome: [decided('termLoanOutcome', 'R3:Meridian Co-operative Bank Term Loan', 'sent_back', r3Split, S)] });
  const out = html(createElement(CaseBoard, { board: b, enter: true }));
  assert.match(out, /href="#\/story\/case\/R1%3ARajesh%20Mehta"/);
  assert.match(out, /href="#\/story\/case\/R3%3AMeridian%20Co-operative%20Bank%20Term%20Loan"/);
  assert.match(out, /href="#\/story\/debrief"/);
  for (const word of ['Approved', 'Answered', 'Sent back']) assert.match(out, new RegExp(`class="chip[^"]*">${word}<`), word);
  assert.ok(out.includes('Synthetic company and data. Nothing here is advice.'));
});

test('meters: role meter with value, range and a spoken verdict; breaking side named', async () => {
  const b = await board({ answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass, S)] });
  const out = html(createElement(Meters, { meters: b.meters }));
  assert.match(out, /role="meter"[^>]*aria-valuenow="1.57[0-9]*"[^>]*aria-valuemin="0"[^>]*aria-valuemax="2"[^>]*aria-valuetext="1.57, above the 1.50 limit"/);
  assert.match(out, /aria-valuemin="0.8"[^>]*aria-valuemax="1.6"[^>]*aria-valuetext="1.23, above the 1.20 floor"/);
  assert.match(out, /transform:scaleX\(0.78[0-9]*\)/);
  const r3 = html(createElement(Meters, { meters: { ...b.meters, currentRatio: { ...b.meters.currentRatio, now: 1.1385 } } }));
  assert.match(r3, /aria-valuetext="1.14, below the 1.20 floor"/);
  const de = html(createElement(Meters, { meters: { ...b.meters, debtEquity: { ...b.meters.debtEquity, now: 1.4 } } }));
  assert.match(de, /aria-valuetext="1.40, within the 1.50 limit"/);
});

test('debrief: decided rows say what happened, unfinished ones say so, and the honesty line explains the break', async () => {
  const b = await board({ answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass, S)], msmeAnswer: [answered('R2:Delta Rubber', S)] });
  const out = html(createElement(Debrief, { board: b, rbi: null, onPlayAgain: () => {} }));
  for (const words of ['Audit-ready?', "Here's what you decided, and what each decision did to the covenants.", 'Approved', 'Move ₹2,50,00,000 from trade payables to short-term borrowings.', 'Debt-equity 1.40 → 1.57 against the 1.50 limit: breaks', 'The covenant breaks because the books are now right, not because the controller failed.', 'https://hq.swapnilsoren.com/builds/audit-readiness-check', 'Synthetic company and data. Nothing here is advice.']) assert.ok(out.includes(words), words);
  assert.equal(out.match(/Not decided yet/g)?.length, 2);
  assert.equal(out.includes("Case closed."), false);
  assert.equal(out.includes("Play again"), true);
  const none = html(createElement(Debrief, { board: await board({}), rbi: null, onPlayAgain: () => {} }));
  assert.equal(none.match(/Not decided yet/g)?.length, 3);
  assert.ok(!none.includes('The covenant breaks because'));
});

test('case screens in the story say sign-off code and lead back to the board; dev screens are unchanged', () => {
  const base = { state: { status: 'loading' } as never, selection: {}, passcode: '', busy: false, message: '', onSelect: () => {}, onPasscode: () => {}, onSave: () => {}, onDecide: () => {} };
  const dev = html(createElement(GapDetailPage, base));
  assert.ok(dev.includes('href="#/"') && dev.includes('← All gaps'));
  const story = html(createElement(TermLoanDetailPage, { ...base, back: { href: '#/story', text: '← Case board' }, codeLabel: 'Sign-off code' } as never));
  assert.ok(story.includes('href="#/story"') && story.includes('← Case board'));
});

test('next step follows the registry: case 1 to 2 to 3, then back to the board', () => {
  assert.deepEqual(nextStep('R1:Rajesh Mehta'), { kind: 'case', flagKey: 'R2:Delta Rubber', title: 'Did we pay a small supplier late?' });
  assert.deepEqual(nextStep('R2:Delta Rubber'), { kind: 'case', flagKey: 'R3:Meridian Co-operative Bank Term Loan', title: 'How much of this loan is due this year?' });
  assert.deepEqual(nextStep('R3:Meridian Co-operative Bank Term Loan'), { kind: 'board' });
  assert.deepEqual(nextStep('R9:Nobody'), { kind: 'board' });
});

test('next case button: the next title, and after the third the way back to the board', () => {
  const first = html(createElement(NextCase, { flagKey: 'R1:Rajesh Mehta' }));
  assert.match(first, /href="#\/story\/case\/R2%3ADelta%20Rubber"/);
  assert.ok(first.includes('Next case: Did we pay a small supplier late? →'));
  assert.ok(html(createElement(NextCase, { flagKey: 'R2:Delta Rubber' })).includes('Next case: How much of this loan is due this year? →'));
  const last = html(createElement(NextCase, { flagKey: 'R3:Meridian Co-operative Bank Term Loan' }));
  assert.match(last, /href="#\/story"/);
  assert.ok(last.includes('Back to the case board →'));
});

const allDecided = () => board({
  answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass, S)],
  msmeAnswer: [answered('R2:Delta Rubber', S)], msmeOutcome: [decided('msmeOutcome', 'R2:Delta Rubber', 'sent_back', r2Due, S)],
  termLoanAnswer: [answered('R3:Meridian Co-operative Bank Term Loan', S)], termLoanOutcome: [decided('termLoanOutcome', 'R3:Meridian Co-operative Bank Term Loan', 'approved', r3Split, S)],
});

test('board when done: all three decided shows the line and the debrief button; otherwise neither', async () => {
  const done = html(createElement(CaseBoard, { board: await allDecided(), enter: false }));
  assert.ok(done.includes('All three cases decided.'));
  assert.match(done, /<a[^>]*href="#\/story\/debrief"[^>]*>See your debrief →<\/a>/);
  assert.ok(done.indexOf('See your debrief →') < done.indexOf('story-cards'), 'near the top, above the cards');
  const open = html(createElement(CaseBoard, { board: await board({ answer: [answered('R1:Rajesh Mehta', S)], outcome: [decided('outcome', 'R1:Rajesh Mehta', 'approved', r1Reclass, S)] }), enter: false }));
  assert.ok(!open.includes('All three cases decided.') && !open.includes('See your debrief'));
});

test("the briefing and the board link to the company's accounts", async () => {
  const brief = html(createElement(Briefing, { board: await board({}, OTHER), code: '', busy: false, message: '', onCode: () => {}, onStart: () => {} }));
  const caseBoard = html(createElement(CaseBoard, { board: await board({}), enter: false }));
  for (const out of [brief, caseBoard]) assert.match(out, /<a[^>]*href="#\/story\/company"[^>]*>See the company's accounts<\/a>/);
});

test('debrief ending: Case closed, the closing line and one set of three actions', async () => {
  const out = html(createElement(Debrief, { board: await allDecided(), rbi: null, onPlayAgain: () => {} }));
  for (const words of ['Case closed.', "That's your first week. Fixed rules worked out every number from the books; you made every call."]) assert.ok(out.includes(words), words);
  assert.match(out, /<a[^>]*href="https:\/\/hq.swapnilsoren.com\/builds\/audit-readiness-check"[^>]*>Read how it was built<\/a>/);
  assert.match(out, /<button[^>]*>Play again<\/button>/);
  assert.match(out, /<a[^>]*href="https:\/\/github.com\/swapnilsagarsoren-code\/audit-readiness-check"[^>]*>See the code<\/a>/);
  assert.equal(out.match(/github\.com/g)?.length, 1);
  assert.equal(out.match(/hq\.swapnilsoren\.com/g)?.length, 1);
  assert.ok(!out.includes('Read the write-up'));
  assert.ok(out.indexOf('Case closed.') > out.indexOf('debrief-rows'), 'the ending comes after the rows');
});

test('play again forgets the session and returns to the briefing', () => {
  const store = new Map<string, string>([['nf-story-session', S]]);
  const g = globalThis as Record<string, unknown>;
  g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  g.location = { hash: '#/story/debrief' };
  playAgain();
  assert.equal(readSession(), null);
  assert.equal((g.location as { hash: string }).hash, '#/story');
  delete g.sessionStorage; delete g.location;
});

test('routes: the company accounts screen', () => {
  assert.deepEqual(parseRoute('#/story/company', false), { kind: 'company' });
});

const crore = (paise: number) => (paise / 1_00_00_000_00).toFixed(2);
test("company figures from the books as booked: P&L, balance sheet, ratios and the audit lens", () => {
  const f = companyFigures(books);
  const p = f.profitAndLoss, b = f.balanceSheet, r = f.ratios;
  assert.deepEqual([p.revenue, p.materials, p.directCosts, p.otherExpenses, p.otherIncome, p.pbt].map(crore), ['150.00', '95.50', '25.12', '20.53', '0.15', '9.00']);
  assert.deepEqual([b.fixedAssets, b.inventory, b.receivables, b.cashAndBank, b.equity, b.borrowings, b.tradePayables].map(crore), ['18.50', '9.00', '27.00', '0.60', '15.20', '21.30', '18.60']);
  for (const v of [...Object.values(p), ...Object.values(b), f.audit.materiality, f.audit.flagLine]) assert.ok(Number.isSafeInteger(v), 'whole paise');
  assert.equal((r.profitMargin * 100).toFixed(1), '6.0');
  assert.deepEqual([r.debtEquity.toFixed(2), r.debtEquityCap, r.currentRatio.toFixed(2), r.currentFloor], ['1.40', 1.5, '1.23', 1.2]);
  assert.deepEqual([r.receivableDays, r.inventoryDays, r.payableDays].map(Math.round), [66, 34, 71]);
  assert.deepEqual(f.audit, { materiality: 45_00_000_00, flagLine: 22_50_000_00 });
});

test('company screen: four tables with the row labels, amounts to one decimal, the note and the way back', () => {
  const out = html(createElement(CompanyPage, { state: { status: 'ready', data: companyFigures(books) }, back: '← Case board', onRetry: () => {} }));
  assert.equal(out.match(/<h1>(.*?)<\/h1>/)![1].replace(/<[^>]+>/g, ''), "Northfield's books, FY2025-26");
  assert.equal(out.match(/<table/g)?.length, 4);
  for (const words of ['Profit and loss', 'Balance sheet', 'Ratios', 'Audit lens', 'Year-end trial balance as booked, before your three decisions. Synthetic company.', 'Synthetic company and data. Nothing here is advice.']) assert.ok(out.includes(words), words);
  const rows: [string, string][] = [['Revenue', '₹150.0 crore'], ['Materials', '₹95.5 crore'], ['Direct costs', '₹25.1 crore'], ['Other expenses', '₹20.5 crore'], ['Other income', '₹15.0 lakh'], ['Profit before tax', '₹9.0 crore'],
    ['Fixed assets', '₹18.5 crore'], ['Inventory', '₹9.0 crore'], ['Receivables', '₹27.0 crore'], ['Cash and bank', '₹60.0 lakh'], ['Equity', '₹15.2 crore'], ['Borrowings', '₹21.3 crore'], ['Trade payables', '₹18.6 crore'],
    ['Profit margin', '6.0%'], ['Debt-equity', '1.40'], ['Current ratio', '1.23'], ['Receivable days', '66'], ['Inventory days', '34'], ['Payable days', '71'],
    ['Materiality', '₹45.0 lakh'], ['Flag line', '₹22.5 lakh']];
  for (const [label, value] of rows) assert.match(out, new RegExp(`<th scope="row"[^>]*>${label}(<|\\s)[\\s\\S]*?<td[^>]*>${value.replace(/[.$]/g, '\\$&')}`), label);
  assert.ok(out.includes('Within the 1.50 limit') && out.includes('Above the 1.20 floor'), 'cap and floor shown');
  assert.match(out, /<a class="back" href="#\/story">← Case board<\/a>/);
  assert.ok(!/<svg|<canvas/.test(out), 'no charts');
});

test('company screen: loading skeleton and an error with Try again', () => {
  const loading = html(createElement(CompanyPage, { state: { status: 'loading' }, back: '← Back to the briefing', onRetry: () => {} }));
  assert.match(loading, /aria-busy="true"/);
  assert.ok(!loading.includes('<table') && loading.includes('← Back to the briefing'));
  const error = html(createElement(CompanyPage, { state: { status: 'error' }, back: '← Case board', onRetry: () => {} }));
  assert.match(error, /role="alert"/);
  assert.match(error, /<button[^>]*>Try again<\/button>/);
});

test('convex story:company is a public query with no arguments over the loaded books', async () => {
  assert.match(await readFile('convex/story.ts', 'utf8'), /export const company = query\(\{ args: \{\}, handler: async ctx => companyFigures\(await loadBooks\(ctx\)\) \}\)/);
});
