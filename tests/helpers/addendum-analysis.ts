// Test/report helpers only. These are deliberately simpler than the future M2 rules.
import {readFile} from 'node:fs/promises';
import {loadSeedData} from '../../scripts/seed-data.ts';
import {trialBalance} from '../../shared/accounting.ts';
import type {SeedEntry} from '../../shared/seed-records.ts';
export type SpecCase={id:string;rule:string;party:string;ledger:string;voucherCount:number;amount:number;side:'dr'|'cr';narration:string;group:string};
export async function analyseAddendum() {
  const data=await loadSeedData('.');
  const fixture=JSON.parse(await readFile('tests/fixtures/spec-cases.json','utf8')) as {cases:SpecCase[]};
  const tb=trialBalance(data.ledgers,data.entries),balance=(name:string)=>tb.balances.get(name)??0;
  const group=(...groups:string[])=>data.ledgers.filter(l=>groups.includes(l.tally_group));
  const sum=(names:string[])=>names.reduce((s,n)=>s+balance(n),0);
  const materials=sum(group('Purchase Accounts').map(l=>l.ledger_name))+balance('Inventory Change');
  const employee=sum(['Wages','Salaries']),depreciation=balance('Depreciation'),finance=sum(['Loan Interest','Bank Charges']);
  const allExpenses=sum(group('Purchase Accounts','Direct Expenses','Indirect Expenses').map(l=>l.ledger_name));
  const grossOpening=data.ledgers.filter(l=>l.tally_group==='Fixed Assets').reduce((s,l)=>s+l.opening_dr,0);
  const receivables=sum(group('Sundry Debtors').map(l=>l.ledger_name)),inventory=sum(group('Stock-in-Hand').map(l=>l.ledger_name));
  const concentration=new Map<string,number>();for(const e of data.entries)concentration.set(e.party,(concentration.get(e.party)??0)+1);
  const groups=new Map(data.ledgers.map(l=>[l.ledger_name,l.tally_group]));
  const voucherRows=Map.groupBy(data.entries,e=>e.voucher_no);
  const ledgerRows=Map.groupBy(data.entries,e=>e.ledger);
  const hits:Record<string,SeedEntry[]>={R1:[],R2:[],R3:[],R4:[],R5:[]};
  for(const [name,rows] of ledgerRows) {
    if(['Sundry Creditors','Unsecured Loans'].includes(groups.get(name)??'')) {
      const receipt=rows.find(e=>e.voucher_type==='Receipt'&&e.cr>0&&e.cr%10000000===0&&voucherRows.get(e.voucher_no)!.some(other=>groups.get(other.ledger)==='Bank Accounts'&&other.dr===e.cr));
      const hasPurchases=rows.some(e=>e.voucher_type==='Purchase');
      // R1's normal-creditor exclusion: matched purchases must be absent.
      if(receipt&&!hasPurchases)hits.R1.push(receipt);
    }
    if(['Secured Loans','Unsecured Loans'].includes(groups.get(name)??'')&&/term\s+loan/i.test(name)&&!data.ledgers.some(l=>/current maturit/i.test(l.ledger_name))) {
      const receipt=rows.find(e=>e.cr>0&&e.voucher_type==='Receipt');if(receipt)hits.R3.push(receipt);
    }
  }
  for(const supplier of data.suppliers) {
    if(!['Micro','Small',''].includes(supplier.msme_status))continue;
    const bills=data.entries.filter(e=>e.ledger===supplier.supplier&&e.voucher_type==='Purchase'&&e.cr>0);
    for(const bill of bills) {
      const payment=data.entries.find(e=>e.ledger===supplier.supplier&&e.voucher_type==='Payment'&&e.narration===`Payment against invoice ${bill.voucher_no}`);
      const end=payment?.date??'2026-03-31T00:00:00+05:30';
      const days=(Date.parse(end)-Date.parse(bill.date))/86400000;
      const terms=supplier.written_credit_days===null?15:Math.min(45,supplier.written_credit_days);
      if(supplier.msme_status===''||days>terms)hits.R2.push(bill);
    }
  }
  // Fixed 20-lakh screen captures Arena too; this is NOT M2 materiality.
  const assetVendors=['Kaveri Machine Tools','Om Constructions','Arena Motors'];
  for(const e of data.entries) {
    if(e.ledger==='Repairs & Maintenance'&&e.dr>=200000000&&(/\b(new|replacement|installation|upgrade|construction)\b/i.test(e.narration)||assetVendors.includes(e.party)))hits.R4.push(e);
    if(groups.get(e.ledger)==='Sales Accounts'&&e.cr>0&&/scrap|claim|insurance|interest|\brent\b|incentive|RoDTEP|exchange gain|sale of (?:old )?(?:lathe )?(?:machine|asset)/i.test(e.narration))hits.R5.push(e);
  }
  const match=(e:SeedEntry,rule:string)=>fixture.cases.find(c=>c.rule===rule&&c.party===e.party&&c.ledger===e.ledger&&c.narration===e.narration);
  const guardReport=Object.fromEntries(Object.entries(hits).map(([rule,rows])=>[rule,{
    plantedHits:rows.filter(e=>match(e,rule)?.id.startsWith('P')).length,
    decoyHits:rows.filter(e=>match(e,rule)?.id.startsWith('D')).length,
    backgroundHits:rows.filter(e=>!match(e,rule)).length,
    plantedIds:[...new Set(rows.map(e=>match(e,rule)?.id).filter((id):id is string=>Boolean(id?.startsWith('P'))))].sort(),
  }]));
  return {data,fixture,tb,balance,materials,employee,depreciation,finance,otherExpenses:allExpenses-materials-employee-depreciation-finance,
    grossOpening,accumulatedOpening:data.ledgers.find(l=>l.ledger_name==='Accumulated Depreciation')!.opening_cr,
    fixedAssets:sum(group('Fixed Assets').map(l=>l.ledger_name)),receivables,inventory,
    receivableDays:receivables/tb.revenue*365,inventoryDays:inventory/materials*365,
    concentration:[...concentration].map(([party,lines])=>({party,lines,share:lines/data.entries.length})).sort((a,b)=>b.lines-a.lines),
    hits,guardReport};
}
