import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEvidence } from '../../shared/evidence.ts';
import { evidenceBundle } from '../../shared/evidence-bundle.ts';

const ids = (xs: { id: string }[]) => xs.map(x => x.id);

test('R1 lists 7 of the 8 documents until the answer is a loan, then all 8 with the board resolution', () => {
  const before = evidenceBundle('R1', { isLoan: false });
  assert.equal(before.length, 7);
  assert.ok(!ids(before).includes('R1-BOARD-RESOLUTION'));
  const after = evidenceBundle('R1', { isLoan: true });
  assert.deepEqual(ids(after), ids(getEvidence('R1')));
  assert.equal(after.length, 8);
});

test('R1 default (answer not given yet) is the 7-document list', () => {
  assert.equal(evidenceBundle('R1').length, 7);
});

test('R2, R3 and R4 always list the whole approved list, in the approved order', () => {
  for (const rule of ['R2', 'R3', 'R4'] as const) {
    assert.deepEqual(ids(evidenceBundle(rule)), ids(getEvidence(rule)));
    assert.deepEqual(ids(evidenceBundle(rule, { isLoan: true })), ids(getEvidence(rule)));
  }
});

test('R5 bundles are not built yet and refuse rather than guess', () => {
  assert.throws(() => evidenceBundle('R5'));
});

test('returned items are copies: changing them does not change the approved list', () => {
  const bundle = evidenceBundle('R2');
  bundle[0].label = 'changed';
  assert.notEqual(evidenceBundle('R2')[0].label, 'changed');
});
