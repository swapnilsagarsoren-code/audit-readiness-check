import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { GapDetailPage, type DetailData, type DetailState } from '../../src/GapDetail.tsx';
import { refusalText, visibleFollowups } from '../../src/gap-detail-logic.ts';
import { R1_FOLLOWUPS, R1_NATURE_BUTTONS } from '../../shared/r1-question.ts';

const noop = () => {};
const detail: DetailData = {
  flag: { flagKey: 'R1:Rajesh Mehta', ledger: 'Rajesh Mehta', party: 'Rajesh Mehta', amount: 2_50_00_000_00, band: 'flagged', related: true },
  entries: [
    { voucher_no: 'NF-00001', date: '2025-04-05T00:00:00+05:30', amount: 1_00_000_000, narration: 'temporary funds from MD' },
    { voucher_no: 'NF-00002', date: '2025-05-05T00:00:00+05:30', amount: 1_00_000_000, narration: 'temporary funds from MD' },
  ],
  question: { context: "The books show 3 receipts from the bank into Rajesh Mehta's account, totalling ₹2,50,00,000, between 5 April 2025 and 5 June 2025. The narration reads 'temporary funds from MD'.", question: 'What was this money received for?', text: '' },
  natureButtons: R1_NATURE_BUTTONS, followups: R1_FOLLOWUPS,
  evidence: [{ id: 'R1-LOAN-AGREEMENT', label: 'Loan agreement or letter stating terms' }, { id: 'R1-BANK-STATEMENT', label: 'Bank statement lines for the receipts' }],
  answer: null, snapshot: null, decision: null,
};
const snapshot = {
  outcome: { kind: 'reclass' as const, caption: 'Short-term borrowings: Loans and advances from related parties', entry: { debit: 'Rajesh Mehta', credit: 'Short-term borrowings: Loans and advances from related parties', amount: 2_50_00_000_00 }, relatedPartyDisclosure: true, legalReview: false, note: 'Move from trade payables to borrowings. Related-party disclosure (AS 18): controller to confirm.' },
  before: { debt: 21_30_00_000_00, equity: 15_20_00_000_00, ratio: 1.4013 }, after: { debt: 23_80_00_000_00, equity: 15_20_00_000_00, ratio: 1.5657 },
  covenantMax: 1.5, covenantBefore: 'within' as const, covenantAfter: 'breach' as const,
};
const html = (state: DetailState, selection = {}, extra = {}) => renderToStaticMarkup(createElement(GapDetailPage, { state, selection, passcode: '', busy: false, message: '', onSelect: noop, onPasscode: noop, onSave: noop, onDecide: noop, ...extra }));

test('detail: back link, heading, entries table with header cells and plain dates, chosen words', () => {
  const out = html({ status: 'ready', data: detail });
  assert.ok(out.includes('href="#/"'));
  assert.ok(out.includes('Rajesh Mehta'));
  assert.ok(out.includes('What the books show'));
  assert.match(out, /<th[^>]*>Voucher<\/th>/);
  assert.ok(out.includes('5 April 2025'));
  assert.ok(out.includes('NF-00001'));
  assert.ok(out.includes('temporary funds from MD'));
});

test('the question is the context line plus one question, with the answer buttons separate and nothing pre-selected', () => {
  const out = html({ status: 'ready', data: detail });
  assert.ok(out.includes('What was this money received for?'));
  for (const b of R1_NATURE_BUTTONS) assert.ok(out.includes(`>${b.label}<`), b.label);
  assert.equal((out.match(/aria-pressed="true"/g) ?? []).length, 0);
  assert.doesNotMatch(out.slice(out.indexOf('What the books show'), out.indexOf('What was this money received for?')), />Loan</);
});

test('follow-ups appear only after the answer needs them', () => {
  assert.deepEqual(visibleFollowups({}).map(f => f.id), []);
  assert.deepEqual(visibleFollowups({ nature: 'goods_services' }).map(f => f.id), []);
  assert.deepEqual(visibleFollowups({ nature: 'loan' }).map(f => f.id), ['counterparty', 'term']);
  assert.deepEqual(visibleFollowups({ nature: 'loan', counterparty: 'director' }).map(f => f.id), ['counterparty', 'term', 'declaration']);
  assert.deepEqual(visibleFollowups({ nature: 'loan', counterparty: 'shareholder' }).map(f => f.id), ['counterparty', 'term']);
  const out = html({ status: 'ready', data: detail }, { nature: 'loan', counterparty: 'director' });
  assert.ok(out.includes('Who provided the money?') && out.includes('When is it to be repaid?'));
  assert.ok(out.includes('Does the company hold a written declaration'));
  assert.equal((out.match(/aria-pressed="true"/g) ?? []).length, 2);
});

test('documents to ask for are listed by code, and the passcode box says what it is for', () => {
  const out = html({ status: 'ready', data: detail });
  assert.ok(out.includes('Loan agreement or letter stating terms'));
  assert.ok(out.includes('Edit passcode'));
  assert.ok(out.includes('Needed to save an answer or a decision.'));
  assert.match(out, /type="password"/);
  assert.match(out, /autoComplete="off"/);
});

test('outcome: fixed sentence, proposed entry, debt-equity before and after, covenant verdict in words, before-tax note', () => {
  const out = html({ status: 'ready', data: { ...detail, answer: { nature: 'loan' }, snapshot } }, { nature: 'loan' });
  assert.ok(out.includes('Move from trade payables to borrowings.'));
  assert.ok(out.includes('Debt-equity, before and after'));
  assert.ok(out.includes('1.40') && out.includes('1.57'));
  assert.ok(out.includes('Covenant maximum 1.50.'));
  assert.ok(out.includes('Within the 1.50 limit') && out.includes('Above the 1.50 limit'));
  assert.ok(out.includes('Equity includes profit before tax as booked.'));
  assert.ok(out.includes('Proposed entry'));
  assert.ok(out.includes('₹2,50,00,000'));
});

test('approval: Approve and Send back, with the no-books line; a recorded decision is shown in words', () => {
  const withAnswer = { ...detail, answer: { nature: 'loan' }, snapshot };
  const out = html({ status: 'ready', data: withAnswer }, { nature: 'loan' });
  assert.ok(out.includes('>Approve<') && out.includes('>Send back<'));
  assert.ok(out.includes('Nothing is written to the books. This records your decision only.'));
  const done = html({ status: 'ready', data: { ...withAnswer, decision: { decision: 'approved', decidedAt: 1 } } }, { nature: 'loan' });
  assert.ok(done.includes('Approved'));
});

test('an answer that needs more detail shows no ratio table and no approve button', () => {
  const ask = { ...snapshot, outcome: { ...snapshot.outcome, kind: 'ask_more' as const, entry: undefined, note: 'More answers are needed before an outcome can be shown.' }, after: undefined, covenantAfter: undefined };
  const out = html({ status: 'ready', data: { ...detail, answer: { nature: 'loan' }, snapshot: ask } }, { nature: 'loan' });
  assert.ok(out.includes('More answers are needed'));
  assert.ok(!out.includes('>Approve<'));
});

test('loading, error and not-found states show no figures; the error uses an alert', () => {
  assert.match(html({ status: 'loading' }), /aria-busy="true"/);
  assert.doesNotMatch(html({ status: 'loading' }), /₹/);
  const err = html({ status: 'error' });
  assert.match(err, /role="alert"/);
  assert.ok(err.includes('Nothing here is final.'));
  assert.ok(html({ status: 'missing' }).includes('Nothing to review here.'));
  assert.ok(html({ status: 'error' }, {}, { onRetry: noop }).includes('>Try again<'));
});

test('refusal messages are plain and never echo the passcode', () => {
  assert.equal(refusalText('wrong'), 'That passcode is wrong.');
  assert.match(refusalText('locked'), /locked until the next hour/);
  assert.match(refusalText('disabled'), /not switched on/);
  assert.match(refusalText('anything else'), /Nothing was changed/);
});

test('no banned wording anywhere on the screen', () => {
  const out = html({ status: 'ready', data: { ...detail, answer: { nature: 'loan' }, snapshot } }, { nature: 'loan', counterparty: 'director' });
  assert.doesNotMatch(out, /fraud|forensic|platform|continuously tracks|red flag|error found|AI decided/i);
});

test('Approve and Send back are disabled while the buttons differ from the saved answer, and the screen says why', () => {
  const saved = { ...detail, answer: { nature: 'loan', counterparty: 'director', term: 'within_12_months', declaration: 'yes' }, snapshot };
  const same = html({ status: 'ready', data: saved }, { nature: 'loan', counterparty: 'director', term: 'within_12_months', declaration: 'yes' }, { passcode: 'x' });
  assert.doesNotMatch(same, /Save the answer first/);
  assert.match(same, /<button type="button">Approve<\/button>/);
  const changed = html({ status: 'ready', data: saved }, { nature: 'loan', counterparty: 'other', term: 'within_12_months' }, { passcode: 'x' });
  assert.match(changed, /Save the answer first/);
  assert.match(changed, /<button type="button" disabled="">Approve<\/button>/);
});

test('an escalated answer offers only Send back; the ratio shows three decimals right next to the limit', () => {
  const esc = { ...snapshot, outcome: { ...snapshot.outcome, kind: 'escalate' as const, entry: undefined, note: 'x' }, after: undefined, covenantAfter: undefined };
  const out = html({ status: 'ready', data: { ...detail, answer: { nature: 'deposit' }, snapshot: esc } }, { nature: 'deposit' });
  assert.ok(!out.includes('>Approve<') && out.includes('>Send back<'));
  const near = { ...snapshot, after: { ...snapshot.after, ratio: 1.504 } };
  const o2 = html({ status: 'ready', data: { ...detail, answer: { nature: 'loan' }, snapshot: near } }, { nature: 'loan' });
  assert.ok(o2.includes('1.504') && o2.includes('Above the 1.50 limit'));
});
