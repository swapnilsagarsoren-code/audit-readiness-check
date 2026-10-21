import { v } from 'convex/values';
import { internalMutation,internalQuery } from './functions';
import { companyFields } from './schema';
import { assertSeedAllowed,planUpserts,entryKey } from '../shared/seed-plan';
import { validateLedger,validateEntry,validateSupplier } from '../shared/seed-records';
const ledger=v.object({ledger_name:v.string(),tally_group:v.string(),opening_dr:v.number(),opening_cr:v.number()});
const entry=v.object({date:v.string(),voucher_no:v.string(),voucher_type:v.string(),ledger:v.string(),dr:v.number(),cr:v.number(),party:v.string(),narration:v.string(),entered_by:v.string(),entered_at:v.string(),line_no:v.number(),amount:v.number()});
const supplier=v.object({supplier:v.string(),msme_status:v.string(),written_credit_days:v.union(v.number(),v.null())});
const payload=v.union(v.object({kind:v.literal('company'),rows:v.array(v.object(companyFields))}),v.object({kind:v.literal('ledger'),rows:v.array(ledger)}),v.object({kind:v.literal('entry'),rows:v.array(entry)}),v.object({kind:v.literal('supplier'),rows:v.array(supplier)}));
export const seedSynthetic=internalMutation({args:{payload},handler:async(ctx,{payload})=>{
  assertSeedAllowed(process.env);
  if(payload.rows.length<1||payload.rows.length>100) throw new Error('Seeding refused: chunks must contain 1 to 100 rows.');
  // Plan each chunk with the same pure function exercised by unit tests.
  if(payload.kind==='company') {
    for(const row of payload.rows){
      if(!row.name || !row.fy || !row.start || !row.end) throw new Error('Seeding refused: incomplete company period.');
      const old=await ctx.db.query('company').withIndex('by_name',q=>q.eq('name',row.name)).unique();
      const clean=old?Object.fromEntries(Object.entries(old).filter(([k])=>!k.startsWith('_'))):undefined;
      const plan=planUpserts(clean?[clean]:[],[row],r=>String(r.name));
      if(plan.inserts.length) await ctx.db.insert('company',row); else if(plan.updates.length&&old) await ctx.db.replace(old._id,row);
      const period={fy:row.fy,start:row.start,end:row.end,companyName:row.name};
      const prior=await ctx.db.query('period').withIndex('by_fy',q=>q.eq('fy',row.fy!)).unique();
      if(!prior) await ctx.db.insert('period',period); else if(prior.start!==period.start||prior.end!==period.end||prior.companyName!==period.companyName) await ctx.db.replace(prior._id,period);
    }
  } else if(payload.kind==='ledger') {
    payload.rows.forEach(validateLedger);
    const existing=await ctx.db.query('ledger').collect();
    const records=existing.map(({_id,_creationTime,...r})=>({...r,opening_dr:r.opening_dr??0,opening_cr:r.opening_cr??0}));
    const plan=planUpserts(records,payload.rows,r=>r.ledger_name);
    for(const row of plan.inserts) await ctx.db.insert('ledger',row);
    for(const row of plan.updates) await ctx.db.replace(existing.find(r=>r.ledger_name===row.ledger_name)!._id,row);
  } else if(payload.kind==='supplier') {
    payload.rows.forEach(validateSupplier);
    const existing=await ctx.db.query('supplier').collect();
    const plan=planUpserts(existing.map(({_id,_creationTime,...r})=>r),payload.rows,r=>r.supplier);
    for(const row of plan.inserts) await ctx.db.insert('supplier',row);
    for(const row of plan.updates) await ctx.db.replace(existing.find(r=>r.supplier===row.supplier)!._id,row);
  } else {
    payload.rows.forEach(validateEntry);
    planUpserts([],payload.rows,entryKey); // Detect duplicate input keys before writes.
    for(const row of payload.rows) {
      if(!await ctx.db.query('ledger').withIndex('by_name',q=>q.eq('ledger_name',row.ledger)).unique()) throw new Error('Seeding refused: entry references an unknown ledger.');
      const old=await ctx.db.query('entry').withIndex('by_voucher_line',q=>q.eq('voucher_no',row.voucher_no).eq('line_no',row.line_no)).unique();
      const clean=old?(({_id,_creationTime,...r})=>r)(old):undefined;
      const plan=planUpserts(clean?[clean]:[],[row],entryKey);
      if(plan.inserts.length) await ctx.db.insert('entry',row); else if(plan.updates.length&&old) await ctx.db.replace(old._id,row);
    }
  }
  return {processed:payload.rows.length};
}});
export const counts=internalQuery({args:{},handler:async(ctx)=>{
  assertSeedAllowed(process.env);
  return {ledgers:(await ctx.db.query('ledger').collect()).length,entries:(await ctx.db.query('entry').collect()).length,suppliers:(await ctx.db.query('supplier').collect()).length};
}});
