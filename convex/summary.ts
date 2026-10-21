import { query } from './functions';
import { trialBalance, type Entry } from '../shared/accounting';
export const get=query({args:{},handler:async(ctx)=>{
  const companies=await ctx.db.query('company').collect();
  if(companies.length===0) return null;
  if(companies.length!==1) throw new Error('Company selection is unavailable.');
  const company=companies[0];
  const ledgers=await ctx.db.query('ledger').collect(), entries=await ctx.db.query('entry').collect(), suppliers=await ctx.db.query('supplier').collect();
  if(ledgers.length!==company.expectedLedgerCount||entries.length!==company.expectedEntryCount||suppliers.length!==company.expectedSupplierCount) return null;
  const normalized=entries.map(e=>{
    if(e.ledger===undefined||e.dr===undefined||e.cr===undefined||e.voucher_no===undefined) throw new Error('Incomplete entries.');
    return e as Entry;
  });
  const tb=trialBalance(ledgers.map(l=>({...l,opening_dr:l.opening_dr??0,opening_cr:l.opening_cr??0})),normalized);
  return {name:company.name,fy:company.fy??'',ledgerCount:ledgers.length,voucherCount:new Set(entries.map(e=>e.voucher_no)).size,dr:tb.dr,cr:tb.cr};
}});
