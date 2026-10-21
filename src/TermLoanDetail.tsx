import * as React from 'react';
import { formatIndianRupees } from '../shared/flag-input.ts';
void React;

type Split = { balance: number; totalInstalments: number; paid: number; remaining: number; instalment: number; due12: number };
type Ratio = { assets: number; liabilities: number; ratio: number };
export type TermLoanSelection = { documents?: string };
export type TermLoanData = {
  flag: { flagKey: string; party: string; ledger: string; amount: number; band: 'flagged' | 'below' };
  context: string; question: { question: string; buttons: { value: string; label: string }[] }; evidence: { id: string; label: string }[];
  answer: Record<string, unknown> | null;
  snapshot: null | {
    kind: 'split' | 'estimate' | 'cannot_compute' | 'ask_more'; split: Split | null; entry?: { debit: string; credit: string; amount: number };
    currentBefore?: Ratio; currentAfter?: Ratio; covenantMin?: number; covenantBefore?: 'within' | 'breach'; covenantAfter?: 'within' | 'breach'; notes: string[];
  };
  decision: null | { decision: 'approved' | 'sent_back'; decidedAt: number };
};
export type TermLoanState = { status: 'loading' | 'error' | 'missing' } | { status: 'ready'; data: TermLoanData };
type Props = {
  state: TermLoanState; selection: TermLoanSelection; passcode: string; busy: boolean; message: string;
  onRetry?: () => void; onSelect: (value: string) => void; onPasscode: (value: string) => void; onSave: () => void; onDecide: (decision: 'approved' | 'sent_back') => void;
};
const verdict = (v: 'within' | 'breach', min: number) => `${v === 'within' ? 'Within' : 'Below'} the ${min.toFixed(2)} floor`;

export function TermLoanDetailPage({ state, selection, passcode, busy, message, onRetry, onSelect, onPasscode, onSave, onDecide }: Props) {
  const data = state.status === 'ready' ? state.data : null;
  const dirty = !!data && (selection.documents ?? undefined) !== (((data.answer ?? {}) as TermLoanSelection).documents ?? undefined);
  const snap = data?.snapshot ?? null;
  return <section className="detail" aria-label="Gap detail" aria-busy={state.status === 'loading'}>
    <a className="back" href="#/">← All gaps</a>
    {state.status === 'loading' && <div className="skeleton" aria-hidden="true" />}
    {state.status === 'error' && <><p role="alert">Couldn't load this gap. Nothing here is final.</p>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</>}
    {state.status === 'missing' && <p>Nothing to review here.</p>}
    {data && <>
      <h2>{data.flag.party}</h2>
      <p className="gaps-line">{formatIndianRupees(data.flag.amount)} closing balance · {data.flag.band === 'flagged' ? 'Flagged' : 'Below flag line'}</p>

      <h3>What the books show</h3>
      <p className="question-context">{data.context}</p>

      <h3>The question</h3>
      <fieldset className="ask">
        <legend>{data.question.question}</legend>
        <div className="choices">{data.question.buttons.map(b => <button key={b.value} type="button" className="choice" aria-pressed={selection.documents === b.value} onClick={() => onSelect(b.value)}>{b.label}</button>)}</div>
      </fieldset>

      <h3>Documents to ask for</h3>
      <ul className="docs">{data.evidence.map(d => <li key={d.id}>{d.label}</li>)}</ul>

      <div className="passcode">
        <label htmlFor="edit-passcode">Edit passcode</label>
        <input id="edit-passcode" type="password" autoComplete="off" value={passcode} onChange={ev => onPasscode(ev.target.value)} />
        <p className="note">Needed to save an answer or a decision.</p>
        <button type="button" onClick={onSave} disabled={busy || !selection.documents || passcode === ''}>Save answer</button>
        <p aria-live="polite" className="message">{message}</p>
      </div>

      {snap && <>
        <h3>What this means for the accounts</h3>
        {snap.notes.map((n, i) => <p key={i}>{n}</p>)}
        {snap.split && snap.entry && snap.currentBefore && snap.currentAfter && snap.covenantBefore && snap.covenantAfter && snap.covenantMin !== undefined && <>
          <h4>Due within 12 months</h4>
          <div className="table-wrap"><table><tbody>
            <tr><th scope="row">Closing balance</th><td className="num">{formatIndianRupees(snap.split.balance)}</td></tr>
            <tr><th scope="row">Instalments left ({snap.split.remaining} of {snap.split.totalInstalments})</th><td className="num">{formatIndianRupees(snap.split.instalment)} each</td></tr>
            <tr><th scope="row">Due within 12 months</th><td className="num">{formatIndianRupees(snap.split.due12)}</td></tr>
          </tbody></table></div>
          <h4>Proposed entry</h4>
          <div className="table-wrap"><table>
            <thead><tr><th scope="col">Account</th><th scope="col" className="num">Debit</th><th scope="col" className="num">Credit</th></tr></thead>
            <tbody>
              <tr><td>{snap.entry.debit}</td><td className="num">{formatIndianRupees(snap.entry.amount)}</td><td className="num" /></tr>
              <tr><td>{snap.entry.credit}</td><td className="num" /><td className="num">{formatIndianRupees(snap.entry.amount)}</td></tr>
            </tbody>
          </table></div>
          <h4>Current ratio, before and after</h4>
          <div className="table-wrap"><table>
            <thead><tr><th scope="col" /><th scope="col" className="num">Before</th><th scope="col" className="num">After</th></tr></thead>
            <tbody>
              <tr><th scope="row">Current ratio</th><td className="num">{snap.currentBefore.ratio.toFixed(2)}</td><td className="num">{snap.currentAfter.ratio.toFixed(2)}</td></tr>
              <tr><th scope="row">Against the floor</th><td className="num">{verdict(snap.covenantBefore, snap.covenantMin)}</td><td className="num">{verdict(snap.covenantAfter, snap.covenantMin)}</td></tr>
            </tbody>
          </table></div>
          <p className="note">Covenant minimum {snap.covenantMin.toFixed(2)}.</p>
        </>}
        {snap.kind !== 'ask_more' && <div className="approval">
          {dirty && <p className="note">Save the answer first. The outcome above is for the saved answer.</p>}
          {data.decision && <p className="decision">{data.decision.decision === 'approved' ? 'Approved' : 'Sent back'}</p>}
          <div className="actions">
            {snap.kind === 'split' && <button type="button" onClick={() => onDecide('approved')} disabled={busy || dirty || passcode === ''}>Approve</button>}
            <button type="button" className="secondary" onClick={() => onDecide('sent_back')} disabled={busy || dirty || passcode === ''}>Send back</button>
          </div>
          <p className="note">Nothing is written to the books. This records your decision only.</p>
        </div>}
      </>}
    </>}
  </section>;
}
