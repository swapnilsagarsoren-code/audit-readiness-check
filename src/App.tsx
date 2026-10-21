import * as React from 'react';
const { useEffect, useState } = React;
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { GapsPage, type GapsData, type GapsState } from './GapsPage.tsx';
import { isGapsData } from './gaps-data.ts';
import { GapDetailPage, type DetailData, type DetailState } from './GapDetail.tsx';
import { refusalText, type Selection } from './gap-detail-logic.ts';
import { MsmeDetailPage, type MsmeData, type MsmeState } from './MsmeDetail.tsx';
import type { MsmeSelection } from './msme-detail-logic.ts';
import { TermLoanDetailPage, type TermLoanData, type TermLoanState } from './TermLoanDetail.tsx';
export type Summary = {name:string;fy:string;ledgerCount:number;voucherCount:number;dr:number;cr:number};
export type ViewState = {status:'loading'|'error'|'empty'} | {status:'ready';data:Summary};
const summaryQuery=makeFunctionReference<'query',Record<string,never>,Summary|null>('summary:get');
const money=(paise:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2}).format(paise/100);
const flagsQuery=makeFunctionReference<'query',Record<string,never>,GapsData|null>('flags:list');
const detailQuery=makeFunctionReference<'query',{flagKey:string},DetailData|null>('answers:detail');
type Saved={ok:true}|{ok:false;reason:string};
const recordMutation=makeFunctionReference<'mutation',Record<string,string>,Saved>('answers:record');
const decideMutation=makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back'},Saved>('answers:decide');
const msmeDetailQuery=makeFunctionReference<'query',{flagKey:string},MsmeData|null>('msme:detail');
const msmeRecord=makeFunctionReference<'mutation',Record<string,string>,Saved>('msme:record');
const msmeDecide=makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back'},Saved>('msme:decide');
const loanDetailQuery=makeFunctionReference<'query',{flagKey:string},TermLoanData|null>('termloan:detail');
const loanRecord=makeFunctionReference<'mutation',Record<string,string>,Saved>('termloan:record');
const loanDecide=makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back'},Saved>('termloan:decide');
const routeOf=(hash:string)=>{if(!hash.startsWith('#/gap/')) return null;try{return decodeURIComponent(hash.slice(6));}catch{return '';}};
function useRoute(){
  const [hash,setHash]=useState(()=>window.location.hash);
  useEffect(()=>{const on=()=>setHash(window.location.hash);window.addEventListener('hashchange',on);return ()=>window.removeEventListener('hashchange',on);},[]);
  return routeOf(hash);
}
const client=()=>{const url=import.meta.env.VITE_CONVEX_URL;if(!url) throw new Error('Connection unavailable.');return new ConvexHttpClient(url);};
// One loader and saver for every rule's detail screen: load the page data, keep the buttons the person chose, save, decide, retry.
type Detail={answer:Record<string,unknown>|null};
function useGapDetail<D extends Detail,S extends Record<string,string|undefined>>(o:{flagKey:string;detail:ReturnType<typeof makeFunctionReference<'query',{flagKey:string},D|null>>;record:ReturnType<typeof makeFunctionReference<'mutation',Record<string,string>,Saved>>;decide:ReturnType<typeof makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back'},Saved>>;fields:(keyof S&string)[];dependents:(sel:S,field:keyof S&string,value:string)=>S}) {
  const {flagKey,detail,record,decide,fields,dependents}=o;
  const [state,setState]=useState<{status:'loading'|'error'|'missing'}|{status:'ready';data:D}>({status:'loading'}),[selection,setSelection]=useState<S>({} as S),[passcode,setPasscode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const load=React.useCallback(async(keepSelection:boolean)=>{
    try {
      const d=await client().query(detail,{flagKey});
      if(!d) {setState({status:'missing'});return;}
      setState({status:'ready',data:d});
      if(!keepSelection&&d.answer) setSelection(Object.fromEntries(fields.map(f=>[f,(d.answer as Record<string,string|undefined>)[f]])) as S);
    } catch {setState({status:'error'});}
  },[flagKey,detail,fields]);
  useEffect(()=>{setState({status:'loading'});setSelection({} as S);setMessage('');void load(false);},[flagKey,load]);
  async function run(action:()=>Promise<Saved>,done:string) {
    setBusy(true);setMessage('');
    try {
      const r=await action();
      if(r.ok) {setMessage(done);await load(true);} else setMessage(refusalText(r.reason));
    } catch {setMessage(refusalText('error'));}
    setBusy(false);
  }
  const answeredAt=state.status==='ready'?Number((state.data.answer??{}).answeredAt??0):0;
  return {
    state,selection,passcode,busy,message,onPasscode:setPasscode,
    onSelect:(field:keyof S&string,value:string)=>setSelection(prev=>dependents({...prev,[field]:value},field,value)),
    onRetry:()=>{setState({status:'loading'});void load(false);},
    onSave:()=>void run(()=>client().mutation(record,{flagKey,passcode,...Object.fromEntries(Object.entries(selection).filter(([,v])=>v!==undefined))} as Record<string,string>),'Answer saved.'),
    onDecide:(decision:'approved'|'sent_back')=>void run(()=>client().mutation(decide,{flagKey,passcode,decision,answeredAt}),decision==='approved'?'Approved.':'Sent back.'),
  };
}
const R1_FIELDS=['nature','counterparty','term','declaration'] as (keyof Selection&string)[], R2_FIELDS=['certificate','size','terms'] as (keyof MsmeSelection&string)[], R3_FIELDS=['documents'] as ('documents')[];
function GapDetailContainer({flagKey}:{flagKey:string}) {
  const d=useGapDetail<DetailData,Selection>({flagKey,detail:detailQuery,record:recordMutation,decide:decideMutation,fields:R1_FIELDS,dependents:(sel,field,value)=>{
    if(field==='nature'&&value!=='loan') {delete sel.counterparty;delete sel.term;delete sel.declaration;}
    if(field==='counterparty'&&value!=='director'&&value!=='relative') delete sel.declaration;
    return sel;
  }});
  return <GapDetailPage {...d} state={d.state as DetailState}/>;
}
function MsmeContainer({flagKey}:{flagKey:string}) {
  const d=useGapDetail<MsmeData,MsmeSelection>({flagKey,detail:msmeDetailQuery,record:msmeRecord,decide:msmeDecide,fields:R2_FIELDS,dependents:(sel,field,value)=>{
    if(field==='certificate'&&value!=='yes') delete sel.size;
    return sel;
  }});
  return <MsmeDetailPage {...d} state={d.state as MsmeState}/>;
}
function TermLoanContainer({flagKey}:{flagKey:string}) {
  const d=useGapDetail<TermLoanData,{documents?:string}>({flagKey,detail:loanDetailQuery,record:loanRecord,decide:loanDecide,fields:R3_FIELDS,dependents:sel=>sel});
  return <TermLoanDetailPage {...d} state={d.state as TermLoanState} onSelect={value=>d.onSelect('documents',value)}/>;
}
export function SummaryPage({state,onRefresh,children}:{state:ViewState;onRefresh:()=>void;children?:React.ReactNode}) {
  const data=state.status==='ready'?state.data:null;
  return <main>
    <p className="eyebrow">Synthetic company · FY2025-26</p>
    <h1>{data?.name??'Northfield Auto Components Pvt Ltd'}</h1>
    <p>{data?.fy??'FY2025-26'} · 1 April 2025 – 31 March 2026</p>
    {children}
    <section aria-label="Company totals" aria-busy={state.status==='loading'}>
      <dl>
        <div><dt>Ledger count</dt><dd>{data?.ledgerCount??'—'}</dd></div>
        <div><dt>Voucher count</dt><dd>{data?.voucherCount??'—'}</dd></div>
        <div><dt>TB Dr total</dt><dd>{data?money(data.dr):'—'}</dd></div>
        <div><dt>TB Cr total</dt><dd>{data?money(data.cr):'—'}</dd></div>
      </dl>
      <p data-testid="balanced" className="balanced">{data?`TB balanced: ${data.dr===data.cr?'yes':'no'}`:''}</p>
      <div aria-live="polite">
        {state.status==='loading'&&<p>Loading company data…</p>}
        {state.status==='empty'&&<p>Company data is not ready yet.</p>}
        {state.status==='error'&&<p role="alert">Couldn't load data. Nothing here is final.</p>}
      </div>
      <button type="button" onClick={onRefresh} disabled={state.status==='loading'}>Refresh</button>
    </section>
    <p className="note">TB means trial balance. All figures are synthetic.</p>
  </main>;
}
export default function App() {
  const route=useRoute();
  const [state,setState]=useState<ViewState>({status:'loading'}),[gaps,setGaps]=useState<GapsState>({status:'loading'}),[request,setRequest]=useState(0);
  useEffect(()=>{
    let active=true;
    const timer=setTimeout(()=>{if(active){active=false;setState({status:'error'});setGaps({status:'error'});}},15000);
    async function load() {
      try {
        const url=import.meta.env.VITE_CONVEX_URL;
        if(!url) throw new Error('Connection unavailable.');
        const client=new ConvexHttpClient(url);
        const gapsLoad=client.query(flagsQuery,{}).then((g):GapsState=>g===null?{status:'empty'}:isGapsData(g)?{status:'ready',data:g}:{status:'error'},():GapsState=>({status:'error'}));
        const data=await client.query(summaryQuery,{});
        const gapsState=await gapsLoad;
        if(active) {clearTimeout(timer);setState(data?{status:'ready',data}:{status:'empty'});setGaps(gapsState);}
      } catch { if(active) {clearTimeout(timer);setState({status:'error'});setGaps({status:'error'});} }
    }
    void load(); return ()=>{active=false;clearTimeout(timer);};
  },[request]);
  return <SummaryPage state={state} onRefresh={()=>{setState({status:'loading'});setGaps({status:'loading'});setRequest(r=>r+1);}}>{route===null?<GapsPage state={gaps}/>:(route.startsWith('R2:')?<MsmeContainer key={route} flagKey={route}/>:route.startsWith('R3:')?<TermLoanContainer key={route} flagKey={route}/>:<GapDetailContainer key={route} flagKey={route}/>)}</SummaryPage>;
}
