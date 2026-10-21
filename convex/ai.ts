import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import { internalAction, internalMutation, internalQuery } from './functions';
import { questionFields } from './schema';
import { runWordQuestion, type QuestionRow } from '../shared/ai-workflow';
import { finishUsage, indiaDay, readAiCaps, reserveUsage, type UsageDay } from '../shared/ai-usage';
const ruleId = v.union(v.literal('R1'),v.literal('R2'),v.literal('R3'),v.literal('R4'),v.literal('R5'));
const rawFlag = v.object({flagKey:v.string(),ruleId,ledgerName:v.string(),tallyGroup:v.string(),entries:v.array(v.object({date:v.string(),party:v.string(),narration:v.string(),amountPaise:v.number(),voucherNo:v.string(),lineNo:v.number()}))});
function assertAiAllowed() { if (process.env.AI_ALLOWED !== 'dev-only') throw new Error('AI refused: AI_ALLOWED is not dev-only.'); }
function validateIdentifier(value: string) { if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value)) throw new Error('AI refused: identifier is invalid.'); }
const reserveRef=makeFunctionReference<'mutation'>('ai:reserve');
const saveRef=makeFunctionReference<'mutation'>('ai:save');
const namesRef=makeFunctionReference<'query'>('ai:knownNames');

export const wordQuestion=internalAction({args:{flag:rawFlag,runId:v.string(),runNumber:v.optional(v.number())},handler:async(ctx,{flag,runId,runNumber}) =>
  runWordQuestion(flag,runId,process.env,{
    now:()=>Date.now(),fetch:globalThis.fetch,
    reserve:(runId,promptBytes)=>ctx.runMutation(reserveRef,{runId,promptBytes,reservationId:crypto.randomUUID()}),
    save:async(row,reservation)=>{await ctx.runMutation(saveRef,{row,...(reservation?{reservation}:{})});},
    knownNames:()=>ctx.runQuery(namesRef,{}),
  },runNumber),
});
export const reserve=internalMutation({args:{runId:v.string(),promptBytes:v.number(),reservationId:v.string()},handler:async(ctx,{runId,promptBytes,reservationId})=>{
  assertAiAllowed(); validateIdentifier(runId); validateIdentifier(reservationId);
  if(process.env.AI_ENABLED!=='true') return {ok:false,reason:'AI_DISABLED'};
  const caps=readAiCaps(process.env);
  if(!caps) return {ok:false,reason:'AI_CAPS_INVALID'};
  const day=indiaDay(Date.now());
  const all=await ctx.db.query('aiUsage').collect();
  const prior=all.find(row=>row.day===day);
  const current:UsageDay=prior??{day,calls:0,tokensIn:0,tokensOut:0,reservations:[],runCalls:[]};
  const result=reserveUsage(current,all,runId,reservationId,promptBytes,caps);
  if(!result.ok) return result;
  const {day:usageDay,calls,tokensIn,tokensOut,reservations,runCalls}=result.usage;
  const fields={day:usageDay,calls,tokensIn,tokensOut,reservations,runCalls};
  if(prior) await ctx.db.patch(prior._id,fields); else await ctx.db.insert('aiUsage',fields);
  return {ok:true,day,reservationId};
}});
export const save=internalMutation({args:{row:v.object(questionFields),reservation:v.optional(v.object({day:v.string(),id:v.string(),actual:v.optional(v.object({tokensIn:v.number(),tokensOut:v.number()}))}))},handler:async(ctx,{row,reservation})=>{
  // Disabled attempts can be recorded without opening the provider guard.
  if(process.env.AI_ALLOWED!=='dev-only'&&row.status!=='disabled') throw new Error('AI refused: AI_ALLOWED is not dev-only.');
  const key=process.env.ANTHROPIC_API_KEY;
  if(key&&JSON.stringify(row).includes(key)) throw new Error('AI refused: secret content cannot be stored.');
  if(reservation){
    const prior=await ctx.db.query('aiUsage').withIndex('by_day',q=>q.eq('day',reservation.day)).unique();
    if(!prior) throw new Error('AI usage refused: day is missing.');
    const updated=finishUsage(prior,reservation.id,reservation.actual);
    await ctx.db.patch(prior._id,{tokensIn:updated.tokensIn,tokensOut:updated.tokensOut,reservations:updated.reservations});
  }
  await ctx.db.insert('question',row);
}});
export const knownNames=internalQuery({args:{},handler:async(ctx)=>{
  assertAiAllowed();
  const [ledgers,suppliers,entries]=await Promise.all([ctx.db.query('ledger').collect(),ctx.db.query('supplier').collect(),ctx.db.query('entry').collect()]);
  return [...new Set([...ledgers.map(row=>row.ledger_name),...suppliers.map(row=>row.supplier),...entries.flatMap(row=>row.ledger?[row.party,row.ledger]:[row.party])])].filter(Boolean);
}});
export const questionsForRun=internalQuery({args:{runId:v.string()},handler:async(ctx,{runId})=>{
  assertAiAllowed(); validateIdentifier(runId);
  return ctx.db.query('question').withIndex('by_run',q=>q.eq('runId',runId)).collect();
}});
// Only internal functions are exported: M1 exposes no question text publicly.
export type StoredQuestion = QuestionRow;
