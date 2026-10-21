import { query, internalMutation } from './functions';
import { buildFlagList, RULE_SET_VERSION } from '../shared/flag-list';
import { assertSeedAllowed } from '../shared/seed-plan';
import { loadBooks } from './books';

// Gate A: rule signals only, no AI. Dev-only recompute; the public read returns the stored ranked list.
export const refresh=internalMutation({args:{},handler:async(ctx)=>{
  assertSeedAllowed(process.env);
  const {data}=await loadBooks(ctx);
  const {materiality,flags}=buildFlagList(data);
  for(const old of await ctx.db.query('flag').collect()) await ctx.db.delete(old._id);
  for(const old of await ctx.db.query('flagRun').collect()) await ctx.db.delete(old._id);
  let rank=0;
  for(const f of flags) await ctx.db.insert('flag',{flagKey:f.flagKey,ruleId:f.ruleId,party:f.party,ledger:f.ledger,amount:f.amount,band:f.band,percentOfFlagLine:f.percentOfFlagLine,related:f.related,statusKnown:f.statusKnown,note:f.note,entryRefs:f.entryRefs,ruleVersion:f.ruleVersion,rank:rank++});
  await ctx.db.insert('flagRun',{ruleVersion:RULE_SET_VERSION,computedAt:Date.now(),overall:materiality.overall,flagLine:materiality.flagLine,hideBelow:materiality.hideBelow,basis:materiality.basis,flagCount:flags.length});
  return {flags:flags.length};
}});

export const list=query({args:{},handler:async(ctx)=>{
  const runs=await ctx.db.query('flagRun').collect();
  if(runs.length!==1) return null;
  const run=runs[0];
  const rows=await ctx.db.query('flag').withIndex('by_rank').collect();
  if(rows.length!==run.flagCount) return null;
  return {
    materiality:{overall:run.overall,flagLine:run.flagLine,hideBelow:run.hideBelow,basis:run.basis},
    flags:rows.map(({_id,_creationTime,...f})=>f),
  };
}});
