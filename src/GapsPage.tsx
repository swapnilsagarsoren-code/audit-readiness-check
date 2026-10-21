import * as React from 'react';
import { formatIndianRupees } from '../shared/flag-input.ts';
import { RULE_SET_VERSION } from '../shared/rule-set-version.ts';
import { formatCroreLakh, type GapFlag, type GapsData, type GapsState } from './gaps-data.ts';
void React;
export type { GapsData, GapsState };

const RULE_NAMES: Record<GapFlag['ruleId'], string> = {
  R1: 'Money received that may be a loan',
  R2: 'Small supplier paid late',
  R3: 'Term loan without a current-maturity split',
};

export function GapsPage({ state }: { state: GapsState }) {
  const data = state.status === 'ready' ? state.data : null;
  return <section className="gaps" aria-label="Gaps list" aria-busy={state.status === 'loading'}>
    <h2>Gaps an auditor is likely to raise</h2>
    {data && <p className="gaps-line">Overall materiality {formatCroreLakh(data.materiality.overall)} · Flag line {formatCroreLakh(data.materiality.flagLine)}</p>}
    {state.status === 'loading' && <ol className="gaps-list" aria-hidden="true">{[0, 1, 2, 3].map(i => <li key={i} className="skeleton" />)}</ol>}
    {state.status === 'empty' && <p>No gaps list yet. The books haven't been checked.</p>}
    {state.status === 'error' && <p role="alert">Couldn't load the gaps list. Nothing here is final.</p>}
    {data && data.flags.some(f => f.ruleVersion !== RULE_SET_VERSION) && <p className="note" role="status">The list was built with older rules. Refresh the list before relying on these amounts.</p>}
    {data && data.flags.length === 0 && <>
      <p>No gaps above the flag line.</p>
      <p className="note">Overall materiality is the lower of 1% of revenue and 5% of profit before tax; the flag line is half of it.</p>
    </>}
    {data && data.flags.length > 0 && <ol className="gaps-list">
      {data.flags.map(f => {
        const inner = <>
          <div className="gap-main">
            <span className="gap-rule">{RULE_NAMES[f.ruleId]}</span>
            <span className="gap-party">{f.party}</span>
          </div>
          <div className="gap-figures">
            <span className="gap-amount">{formatIndianRupees(f.amount)}</span>
            <span className="gap-pct">{f.percentOfFlagLine}% of flag line</span>
          </div>
          <div className="gap-tags">
            <span className="chip">{f.band === 'flagged' ? 'Flagged' : 'Below flag line'}</span>
            <span className="chip">Open</span>
            {f.related && <span className="chip">Possible related party</span>}
            {!f.statusKnown && <span className="chip">MSME status missing</span>}
          </div>
        </>;
        return <li key={f.flagKey} className={f.band === 'below' ? 'gap below' : 'gap'}>
          <a className="gap-inner" href={`#/gap/${encodeURIComponent(f.flagKey)}`}>{inner}</a>
        </li>;
      })}
    </ol>}
  </section>;
}
