import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyseAddendum} from '../helpers/addendum-analysis.ts';
import {readCsv} from '../../shared/csv.ts';
const a=await analyseAddendum(),{data,tb,balance}=a;
const crore=1000000000,lakh=10000000;
const band=(value:number,min:number,max:number)=>{assert.ok(value>=min&&value<=max,`${value} outside [${min}, ${max}]`);};

test('A1 cost mix meets all bands and only one capped routine balancing voucher',()=>{
  band(a.materials/tb.revenue*100,61,65);band(a.employee/tb.revenue*100,8.5,12.5);
  band(a.depreciation/tb.revenue*100,1,5);band(a.finance/tb.revenue*100,1,2);
  const openingDep=data.entries.filter(e=>e.ledger==='Depreciation'&&e.narration==='Monthly depreciation on opening asset base').reduce((s,e)=>s+e.dr,0);
  band(openingDep/tb.revenue*100,1,5);
  assert.ok(a.otherExpenses>0);assert.equal(tb.revenue,150*crore);assert.equal(tb.pbt,9*crore);
  const rows=data.entries.filter(e=>e.narration==='Routine professional fee provision for the quarter');
  assert.equal(new Set(rows.map(e=>e.voucher_no)).size,1);assert.equal(rows.length,2);
  const debit=rows.find(e=>e.dr>0)!;assert.ok(debit.dr>0&&debit.dr<=50*lakh);
  assert.equal(rows.find(e=>e.cr>0)!.ledger,'Audit Fee Payable');
  assert.ok(!data.entries.some(e=>e.narration==='Year-end factory operating expense allocation'));
});

test('A2 days, opening asset base and closing assets meet the spec',()=>{
  band(a.receivableDays,55,75);band(a.inventoryDays,20,45);
  assert.equal(a.grossOpening,45*crore);assert.equal(a.accumulatedOpening,27*crore);
  assert.ok(a.fixedAssets>0);assert.ok(a.inventory>0);assert.ok(a.receivables>0);assert.ok(balance('Stores Inventory')>0);
  const opening=data.ledgers.reduce((s,l)=>s+l.opening_dr-l.opening_cr,0);assert.equal(opening,0);
  assert.ok(data.ledgers.find(l=>l.ledger_name==='Retained Earnings')!.opening_cr>0);
  const stockRows=data.entries.filter(e=>data.ledgers.find(l=>l.ledger_name===e.ledger)!.tally_group==='Stock-in-Hand');
  assert.equal(new Set(stockRows.map(e=>e.voucher_no)).size,1);assert.ok(stockRows.every(e=>e.date==='2026-03-31T00:00:00+05:30'&&e.voucher_type==='Journal'));
});

// This mapping is independent of the generator and the answer key, per Addendum A5.
function ratios(){
  const debtGroups=['Secured Loans','Unsecured Loans','Bank OD A/c'];
  const liabilityGroups=['Sundry Creditors','Bank OD A/c','Current Liabilities','Provisions'];
  const assetGroups=['Sundry Debtors','Stock-in-Hand','Bank Accounts','Cash-in-Hand','Current Assets','Loans & Advances (Asset)'];
  let debt=0,liabilities=0,assets=0,equity=tb.pbt;
  for(const l of data.ledgers){
    const b=balance(l.ledger_name);
    if(debtGroups.includes(l.tally_group))debt-=b;
    if(liabilityGroups.includes(l.tally_group))liabilities-=b;
    if(assetGroups.includes(l.tally_group))assets+=b;
    if(l.tally_group==='Duties & Taxes'){if(b>0)assets+=b;else liabilities-=b;}
    if(l.ledger_name==='Corvel Bank Fixed Deposit')assets+=b; // Security Deposits excluded.
    if(['Capital Account','Reserves & Surplus'].includes(l.tally_group))equity-=b;
  }
  // Secured/Unsecured Loans are non-current as booked. Each scenario stands alone.
  return {debt,liabilities,assets,equity,current:assets/liabilities,debtEquity:debt/equity,
    afterR3:assets/(liabilities+2.4*crore),afterR1:(debt+2.5*crore+0.5*crore)/equity};
}
export const achievedRatios=ratios();
test('A3 as booked and each independent fix cross the prescribed covenant boundaries',()=>{
  const r=achievedRatios;band(r.current,1.21,1.25);band(r.debtEquity,1.38,1.45);
  assert.ok(r.equity>0&&r.equity<=20*crore);assert.ok(r.afterR3<1.20);assert.ok(r.afterR1>1.50);
});

test('A4 customer/vendor counts, party concentration and posting users',()=>{
  const customers=new Set(data.entries.filter(e=>e.voucher_type==='Sales').map(e=>e.party));band(customers.size,8,12);band(data.suppliers.length,25,40);
  assert.equal(data.entries.filter(e=>e.party==='Zenvar Motors Ltd'&&e.voucher_type==='Sales'&&e.cr>0).reduce((s,e)=>s+e.cr,0),42*crore);
  for(const row of a.concentration)if(row.party!=='Zenvar Motors Ltd')assert.ok(row.share<=0.20,`${row.party}: ${row.share}`);
  band(new Set(data.entries.map(e=>e.entered_by)).size,2,4);assert.ok(new Set(data.entries.map(e=>e.entered_at.slice(11,16))).size>10);
  band(data.entries.length,2000,3000);
});

test('A2/A4 background supplier invoices settle after 50–60 days, or remain within terms',()=>{
  const caseParties=new Set(a.fixture.cases.map(c=>c.party));
  const suppliers=data.suppliers.filter(s=>!caseParties.has(s.supplier));
  for(const supplier of suppliers){
    assert.notEqual(supplier.msme_status,'');
    const bills=data.entries.filter(e=>e.ledger===supplier.supplier&&e.cr>0&&e.voucher_type==='Purchase');assert.ok(bills.length>0);
    const terms=supplier.written_credit_days??15;
    for(const bill of bills){
      const payment=data.entries.find(e=>e.ledger===supplier.supplier&&e.narration===`Payment against invoice ${bill.voucher_no}`);
      const days=(Date.parse(payment?.date??'2026-03-31T00:00:00+05:30')-Date.parse(bill.date))/86400000;
      if(['Micro','Small'].includes(supplier.msme_status)) {assert.ok(days<=terms);assert.ok(terms<=(supplier.written_credit_days===null?15:45));}
      else {band(terms,50,60);if(payment)band(days,50,60);else assert.ok(days<=terms);}
      if(payment){assert.equal(payment.dr,bill.cr);assert.ok(days>0);}
    }
  }
});

test('A4 background customer sales use credit terms, not same-day receipts',()=>{
  for(const bill of data.entries.filter(e=>e.voucher_type==='Sales'&&e.dr>0)){
    const payment=data.entries.find(e=>e.ledger===bill.ledger&&e.narration===`Receipt against invoice ${bill.voucher_no}`);
    if(payment){assert.ok(payment.date>bill.date);assert.equal(payment.cr,bill.dr);}
  }
});

test('A4 repairs and sales narration constraints cover every background line',()=>{
  for(const e of data.entries){
    const known=a.fixture.cases.some(c=>c.party===e.party&&c.ledger===e.ledger&&c.narration===e.narration);
    if(known)continue;
    if(e.ledger==='Repairs & Maintenance'&&e.dr>0){assert.ok(e.dr<20*lakh);assert.doesNotMatch(e.narration,/new|replacement|installation|upgrade|construction/i);assert.ok(!['Kaveri Machine Tools','Om Constructions','Arena Motors','Talvori Equipment Works','Elvani Civil Works'].includes(e.party));}
    if(e.ledger==='Sales - Components'&&e.cr>0)assert.doesNotMatch(e.narration,/scrap|claim|insurance|interest|\brent\b|incentive|RoDTEP|exchange gain|machine|sale of.*asset/i);
    if(e.voucher_type==='Receipt'&&e.cr>0&&data.ledgers.find(l=>l.ledger_name===e.ledger)!.tally_group==='Sundry Creditors')assert.fail('Unplanted receipt into creditor ledger');
  }
  assert.ok(balance('Other Income')<0);
});

for(const rule of ['R1','R2','R3','R4','R5'])test(`A5 ${rule} guard hits all targeted positives, no decoys and no background`,()=>{
  const report=a.guardReport[rule];
  assert.deepEqual(report.plantedIds,a.fixture.cases.filter(c=>c.rule===rule&&c.id.startsWith('P')).map(c=>c.id).sort());
  assert.equal(report.plantedHits,report.plantedIds.length);assert.equal(report.decoyHits,0);assert.equal(report.backgroundHits,0);
  const decoys=a.fixture.cases.filter(c=>c.rule===rule&&c.id.startsWith('D'));assert.ok(decoys.length>0);
  for(const c of decoys)assert.ok(!a.hits[rule].some(e=>e.party===c.party&&e.ledger===c.ledger&&e.narration===c.narration));
});

test('A2 demand facility is a structural R3 decoy, separate from the handwritten case fixture',()=>{
  const namedCaseLedgers=new Set(a.fixture.cases.map(c=>c.ledger));
  const facilities=data.ledgers.filter(l=>l.tally_group==='Bank OD A/c'&&!namedCaseLedgers.has(l.ledger_name));
  assert.equal(facilities.length,1);assert.doesNotMatch(facilities[0].ledger_name,/term|loan/i);
  assert.ok(balance(facilities[0].ledger_name)<0);assert.ok(!a.hits.R3.some(e=>e.ledger===facilities[0].ledger_name));
  assert.ok(!data.ledgers.some(l=>/current maturit/i.test(l.ledger_name)));
});

test('operating bank stays funded at every day end; seasonal demand drawings net to zero',()=>{
  const daily=new Map<string,number>();for(const e of data.entries)if(e.ledger==='Corvel Bank Current Account')daily.set(e.date,(daily.get(e.date)??0)+e.dr-e.cr);
  let cash=data.ledgers.find(l=>l.ledger_name==='Corvel Bank Current Account')!.opening_dr;
  for(const [date,movement] of [...daily].sort(([a],[b])=>a<b?-1:a>b?1:0)){cash+=movement;assert.ok(cash>=0,`${date}: negative bank balance`);}
  const movements=data.entries.filter(e=>e.narration.startsWith('Working capital facility')&&data.ledgers.find(l=>l.ledger_name===e.ledger)!.tally_group==='Bank OD A/c');
  assert.ok(movements.length>0);assert.equal(movements.reduce((s,e)=>s+e.dr-e.cr,0),0);
});

test('Division I mapping covers every ledger exactly once',async()=>{
  const mapping=readCsv(await readFile('data/answer-key/div1-mapping.csv','utf8'));
  assert.equal(mapping.length,data.ledgers.length);assert.equal(new Set(mapping.map(r=>r.ledger_name)).size,data.ledgers.length);
  assert.deepEqual(mapping.map(r=>r.ledger_name).sort(),data.ledgers.map(l=>l.ledger_name).sort());assert.ok(mapping.every(r=>r.division_i_head.length>0));
});
