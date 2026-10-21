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
import { Briefing, CaseBoard, CompanyPage, Debrief, NextCase, RbiBlock, StoryShell, StorySkeleton, type CompanyState } from './Story.tsx';
import { clearSession, parseRoute, playAgain, readSession, saveSession, type Route } from './story-session.ts';
import { isDecided, STORY_CASES, type CompanyFigures, type RbiStatus, type StoryBoard, type StoryRate } from '../shared/story.ts';
export type Summary = {name:string;fy:string;ledgerCount:number;voucherCount:number;dr:number;cr:number};
export type ViewState = {status:'loading'|'error'|'empty'} | {status:'ready';data:Summary};
const summaryQuery=makeFunctionReference<'query',Record<string,never>,Summary|null>('summary:get');
const money=(paise:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2}).format(paise/100);
const flagsQuery=makeFunctionReference<'query',Record<string,never>,GapsData|null>('flags:list');
const detailQuery=makeFunctionReference<'query',{flagKey:string;sessionId?:string},DetailData|null>('answers:detail');
type Saved={ok:true}|{ok:false;reason:string};
const recordMutation=makeFunctionReference<'mutation',Record<string,string>,Saved>('answers:record');
const decideMutation=makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back';sessionId?:string},Saved>('answers:decide');
const msmeDetailQuery=makeFunctionReference<'query',{flagKey:string;sessionId?:string},MsmeData|null>('msme:detail');
const msmeRecord=makeFunctionReference<'mutation',Record<string,string>,Saved>('msme:record');
const msmeDecide=makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back';sessionId?:string},Saved>('msme:decide');
const loanDetailQuery=makeFunctionReference<'query',{flagKey:string;sessionId?:string},TermLoanData|null>('termloan:detail');
const loanRecord=makeFunctionReference<'mutation',Record<string,string>,Saved>('termloan:record');
const loanDecide=makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back';sessionId?:string},Saved>('termloan:decide');
const boardQuery=makeFunctionReference<'query',{sessionId:string},StoryBoard>('story:board');
const companyQuery=makeFunctionReference<'query',Record<string,never>,CompanyFigures>('story:company');
const startMutation=makeFunctionReference<'mutation',{sessionId:string;code:string},Saved>('visitor:start');
const rbiLatest=makeFunctionReference<'query',Record<string,never>,StoryRate>('rbi:latest');
const rbiCheck=makeFunctionReference<'action',{sessionId:string},{status:RbiStatus;checksLeft:number;rate:StoryRate}>('rbi:check');
function useRoute(){
  const [hash,setHash]=useState(()=>window.location.hash);
  useEffect(()=>{const on=()=>setHash(window.location.hash);window.addEventListener('hashchange',on);return ()=>window.removeEventListener('hashchange',on);},[]);
  return parseRoute(hash,import.meta.env.VITE_STORY==='1');
}
const client=()=>{const url=import.meta.env.VITE_CONVEX_URL;if(!url) throw new Error('Connection unavailable.');return new ConvexHttpClient(url);};
// One loader and saver for every rule's detail screen: load the page data, keep the buttons the person chose, save, decide, retry.
type Detail={answer:Record<string,unknown>|null};
function useGapDetail<D extends Detail,S extends Record<string,string|undefined>>(o:{flagKey:string;sessionId?:string;detail:ReturnType<typeof makeFunctionReference<'query',{flagKey:string;sessionId?:string},D|null>>;record:ReturnType<typeof makeFunctionReference<'mutation',Record<string,string>,Saved>>;decide:ReturnType<typeof makeFunctionReference<'mutation',{flagKey:string;passcode:string;answeredAt:number;decision:'approved'|'sent_back';sessionId?:string},Saved>>;fields:(keyof S&string)[];dependents:(sel:S,field:keyof S&string,value:string)=>S}) {
  const {flagKey,sessionId,detail,record,decide,fields,dependents}=o;
  const own=React.useMemo(()=>sessionId===undefined?{}:{sessionId},[sessionId]);
  const [state,setState]=useState<{status:'loading'|'error'|'missing'}|{status:'ready';data:D}>({status:'loading'}),[selection,setSelection]=useState<S>({} as S),[passcode,setPasscode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const load=React.useCallback(async(keepSelection:boolean)=>{
    try {
      const d=await client().query(detail,{flagKey,...own});
      if(!d) {setState({status:'missing'});return;}
      setState({status:'ready',data:d});
      if(!keepSelection&&d.answer) setSelection(Object.fromEntries(fields.map(f=>[f,(d.answer as Record<string,string|undefined>)[f]])) as S);
    } catch {setState({status:'error'});}
  },[flagKey,own,detail,fields]);
  useEffect(()=>{setState({status:'loading'});setSelection({} as S);setMessage('');void load(false);},[flagKey,load]);
  async function run(action:()=>Promise<Saved>,done:string) {
    setBusy(true);setMessage('');
    try {
      const r=await action();
      if(r.ok) {setMessage(done);await load(true);} else setMessage(refusalText(r.reason,sessionId!==undefined));
    } catch {setMessage(refusalText('error',sessionId!==undefined));}
    setBusy(false);
  }
  const answeredAt=state.status==='ready'?Number((state.data.answer??{}).answeredAt??0):0;
  return {
    state,selection,passcode,busy,message,onPasscode:setPasscode,reload:()=>void load(true),
    onSelect:(field:keyof S&string,value:string)=>setSelection(prev=>dependents({...prev,[field]:value},field,value)),
    onRetry:()=>{setState({status:'loading'});void load(false);},
    onSave:()=>void run(()=>client().mutation(record,{flagKey,passcode,...own,...Object.fromEntries(Object.entries(selection).filter(([,v])=>v!==undefined))} as Record<string,string>),'Answer saved.'),
    onDecide:(decision:'approved'|'sent_back')=>void run(()=>client().mutation(decide,{flagKey,passcode,decision,answeredAt,...own}),decision==='approved'?'Approved.':'Sent back.'),
  };
}
const R1_FIELDS=['nature','counterparty','term','declaration'] as (keyof Selection&string)[], R2_FIELDS=['certificate','size','terms'] as (keyof MsmeSelection&string)[], R3_FIELDS=['documents'] as ('documents')[];
type Story={sessionId:string};
const storyChrome={back:{href:'#/story',text:'← Case board'},codeLabel:'Sign-off code'};
const next=(story:Story|undefined,flagKey:string,state:{status:string;data?:{decision:unknown}})=>story&&state.status==='ready'&&state.data?.decision?<NextCase flagKey={flagKey}/>:null;
function GapDetailContainer({flagKey,story}:{flagKey:string;story?:Story}) {
  const d=useGapDetail<DetailData,Selection>({flagKey,sessionId:story?.sessionId,detail:detailQuery,record:recordMutation,decide:decideMutation,fields:R1_FIELDS,dependents:(sel,field,value)=>{
    if(field==='nature'&&value!=='loan') {delete sel.counterparty;delete sel.term;delete sel.declaration;}
    if(field==='counterparty'&&value!=='director'&&value!=='relative') delete sel.declaration;
    return sel;
  }});
  return <><GapDetailPage {...d} state={d.state as DetailState} {...(story?storyChrome:{})}/>{next(story,flagKey,d.state)}</>;
}
function MsmeContainer({flagKey,story}:{flagKey:string;story?:Story}) {
  const d=useGapDetail<MsmeData,MsmeSelection>({flagKey,sessionId:story?.sessionId,detail:msmeDetailQuery,record:msmeRecord,decide:msmeDecide,fields:R2_FIELDS,dependents:(sel,field,value)=>{
    if(field==='certificate'&&value!=='yes') delete sel.size;
    return sel;
  }});
  return <><MsmeDetailPage {...d} state={d.state as MsmeState} {...(story?storyChrome:{})}>{story&&<RbiCheck sessionId={story.sessionId} onFresh={d.reload}/>}</MsmeDetailPage>{next(story,flagKey,d.state)}</>;
}
function TermLoanContainer({flagKey,story}:{flagKey:string;story?:Story}) {
  const d=useGapDetail<TermLoanData,{documents?:string}>({flagKey,sessionId:story?.sessionId,detail:loanDetailQuery,record:loanRecord,decide:loanDecide,fields:R3_FIELDS,dependents:sel=>sel});
  return <><TermLoanDetailPage {...d} state={d.state as TermLoanState} onSelect={value=>d.onSelect('documents',value)} {...(story?storyChrome:{})}/>{next(story,flagKey,d.state)}</>;
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
const latestRate=()=>client().query(rbiLatest,{});
function RbiCheck({sessionId,onFresh}:{sessionId:string;onFresh?:()=>void}) {
  const check=React.useCallback(()=>client().action(rbiCheck,{sessionId}),[sessionId]);
  return <RbiBlock load={latestRate} check={check} onFresh={onFresh}/>;
}
function CompanyContainer({back}:{back:string}) {
  const [state,setState]=useState<CompanyState>({status:'loading'});
  const load=React.useCallback(()=>{
    let live=true;
    setState({status:'loading'});
    client().query(companyQuery,{}).then(data=>{if(live) setState({status:'ready',data});},()=>{if(live) setState({status:'error'});});
    return ()=>{live=false;};
  },[]);
  useEffect(load,[load]);
  return <CompanyPage state={state} back={back} onRetry={()=>void load()}/>;
}
const CASE_SCREENS={R1:GapDetailContainer,R2:MsmeContainer,R3:TermLoanContainer};
const STARTED_WRONG="Couldn't start. Nothing was saved. Try again.";
// The public story: a briefing until the visitor starts a session, then the case board, the three case screens and the debrief.
// The board is kept between screens so a meter moves from its last value to the new one.
function StoryApp({route}:{route:Exclude<Route,{kind:'home'}|{kind:'gap'}>}) {
  const [sessionId,setSessionId]=useState(readSession);
  const [board,setBoard]=useState<{status:'loading'|'error'}|{status:'ready';data:StoryBoard}>({status:'loading'});
  const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [seen,setSeen]=useState(false);
  const latest=React.useRef(0);
  const load=React.useCallback(async()=>{
    const n=++latest.current;
    try {const data=await client().query(boardQuery,{sessionId:sessionId??''});if(n===latest.current) setBoard({status:'ready',data});}
    catch {if(n===latest.current) setBoard({status:'error'});}
  },[sessionId]);
  const at=route.kind==='case'?route.flagKey:route.kind;
  useEffect(()=>{void load();},[load,at]);
  // Hash links keep the scroll position; a new screen should start at its top.
  useEffect(()=>{window.scrollTo(0,0);},[at]);
  const ready=board.status==='ready'?board.data:null;
  const onBoard=!!ready&&!!sessionId&&ready.session.exists&&route.kind==='story';
  const allDecided=!!ready&&ready.cases.every(c=>isDecided(c.status));
  const [celebrated,setCelebrated]=useState(false);
  const onDebrief=allDecided&&route.kind==='debrief';
  useEffect(()=>{if(onBoard) setSeen(true);},[onBoard]);
  useEffect(()=>{if(onDebrief) setCelebrated(true);},[onDebrief]);
  async function start() {
    setBusy(true);setMessage('');
    try {
      let id=crypto.randomUUID(),r=await client().mutation(startMutation,{sessionId:id,code});
      if(!r.ok&&r.reason==='session_exists') {id=crypto.randomUUID();r=await client().mutation(startMutation,{sessionId:id,code});}
      if(r.ok) {saveSession(id);setCode('');setSessionId(id);}
      else setMessage(r.reason==='busy'?refusalText('busy',true):STARTED_WRONG);
    } catch {setMessage(STARTED_WRONG);}
    setBusy(false);
  }
  if(route.kind==='company') return <CompanyContainer back={sessionId&&board.status==='ready'&&board.data.session.exists&&!board.data.session.expired?'← Case board':'← Back to the briefing'}/>;
  if(board.status!=='ready') return board.status==='loading'?<StoryShell busy><StorySkeleton/></StoryShell>: <StoryShell><p role="alert">Couldn't load the story, so nothing here is final.</p><button type="button" onClick={()=>{setBoard({status:'loading'});void load();}}>Try again</button></StoryShell>;
  const b=board.data;
  if(!sessionId||!b.session.exists) return <Briefing board={b} code={code} busy={busy} message={message} onCode={setCode} onStart={()=>void start()}/>;
  if(b.session.expired) return <StoryShell><p role="alert">This session has ended. Start a new one.</p><button type="button" onClick={()=>{clearSession();setSessionId(null);}}>Start a new session</button></StoryShell>;
  if(route.kind==='debrief') return <Debrief board={b} settle={!celebrated} rbi={<RbiCheck sessionId={sessionId}/>} onPlayAgain={()=>{playAgain();setBoard({status:'loading'});setSessionId(null);setSeen(false);setCelebrated(false);}}/>;
  if(route.kind==='case') {
    const c=STORY_CASES.find(x=>x.flagKey===route.flagKey);
    if(!c) return <StoryShell><a className="back" href="#/story">← Case board</a><p>Nothing to review here.</p></StoryShell>;
    const Screen=CASE_SCREENS[c.ruleId];
    return <StoryShell><Screen key={c.flagKey} flagKey={c.flagKey} story={{sessionId}}/></StoryShell>;
  }
  return <CaseBoard board={b} enter={!seen}/>;
}
export default function App() {
  const route=useRoute();
  if(route.kind!=='home'&&route.kind!=='gap') return <StoryApp route={route}/>;
  return <DevApp route={route}/>;
}
function DevApp({route}:{route:Route}) {
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
  return <SummaryPage state={state} onRefresh={()=>{setState({status:'loading'});setGaps({status:'loading'});setRequest(r=>r+1);}}>{route.kind!=='gap'?<GapsPage state={gaps}/>:(route.flagKey.startsWith('R2:')?<MsmeContainer key={route.flagKey} flagKey={route.flagKey}/>:route.flagKey.startsWith('R3:')?<TermLoanContainer key={route.flagKey} flagKey={route.flagKey}/>:<GapDetailContainer key={route.flagKey} flagKey={route.flagKey}/>)}</SummaryPage>;
}
