import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {generateSynthetic} from '../../scripts/generate-synthetic.ts';
import {loadSeedData} from '../../scripts/seed-data.ts';
import {trialBalance} from '../../shared/accounting.ts';
import {readCsv,writeCsv} from '../../shared/csv.ts';
import {assertSeedAllowed,planUpserts,entryKey} from '../../shared/seed-plan.ts';
import {validateEntry,numberFromCsv} from '../../shared/seed-records.ts';
const data=await loadSeedData('.');
const fixture=JSON.parse(await readFile('tests/fixtures/spec-cases.json','utf8')) as {cases:{id:string;rule:string;party:string;ledger:string;voucherCount:number;amount:number;side:'dr'|'cr';narration:string;group:string}[]};
test('trial balance closes with equal debits and credits',()=>{
  const tb=trialBalance(data.ledgers,data.entries); assert.equal(tb.dr,tb.cr);assert.ok(tb.dr>0);
  assert.equal(data.ledgers.reduce((s,l)=>s+l.opening_dr-l.opening_cr,0),0);
});
test('every voucher balances independently, with integer paise and both sides',()=>{
  const vouchers=Map.groupBy(data.entries,e=>e.voucher_no);
  assert.ok(vouchers.size>0);
  for(const rows of vouchers.values()){
    assert.equal(rows.reduce((s,e)=>s+e.dr-e.cr,0),0);assert.ok(rows.some(e=>e.dr>0));assert.ok(rows.some(e=>e.cr>0));rows.forEach(validateEntry);
  }
});
test('as-booked revenue is exactly 150 crore and PBT exactly 9 crore',()=>{
  const tb=trialBalance(data.ledgers,data.entries);assert.equal(tb.revenue,150000000000);assert.equal(tb.pbt,9000000000);
  assert.equal(data.entries.filter(e=>e.ledger==='Professional Fees'&&e.narration==='Routine professional fee provision for the quarter').length,1);
});
test('expected counts and Addendum A line band cover twelve months inside FY2025-26',()=>{
  assert.equal(data.ledgers.length,data.company.expectedLedgerCount);assert.equal(data.entries.length,data.company.expectedEntryCount);assert.equal(data.suppliers.length,data.company.expectedSupplierCount);assert.ok(data.entries.length>=2000&&data.entries.length<=3000);
  assert.equal(new Set(data.entries.map(e=>e.date.slice(0,7))).size,12);
  for(const e of data.entries){assert.ok(e.date>=data.company.start&&e.date<=data.company.end);assert.match(e.entered_at,/\+05:30$/);}
});
for(const c of fixture.cases) test(`spec fixture ${c.id}: ${c.party}`,()=>{
  const rows=data.entries.filter(e=>e.ledger===c.ledger&&e.party===c.party);
  assert.equal(new Set(rows.map(e=>e.voucher_no)).size,c.voucherCount);
  assert.equal(rows.reduce((s,e)=>s+e[c.side],0),c.amount);
  assert.ok(rows.filter(e=>e[c.side]>0).every(e=>e.narration===c.narration));
  assert.equal(data.ledgers.find(l=>l.ledger_name===c.ledger)?.tally_group,c.group);
});
test('loan receipts have no purchases; invoice-backed payments have matching bill references',()=>{
  for(const party of ['Rajesh Mehta','Anita Mehta','Mehta Family Trust','Sharma Traders']) assert.ok(!data.entries.some(e=>e.party===party&&e.voucher_type==='Purchase'));
  for(const party of ['Kaveri Steel Traders','Lotus Paints']) {
    const rows=data.entries.filter(e=>e.ledger===party),purchase=rows.find(e=>e.voucher_type==='Purchase')!,payment=rows.find(e=>e.voucher_type==='Payment')!;
    assert.equal(payment.dr,purchase.cr);assert.equal(payment.narration,`Payment against invoice ${purchase.voucher_no}`);
  }
});
test('MSME terms, missing status, exact payment ages and unpaid age match the spec',()=>{
  const expected:[string,string,number|null,number|null][]=[['Bharat Fasteners','Micro',45,68],['Delta Rubber','Small',null,30],['Kumar Packaging','',null,null],['Sai Precision Springs','Micro',45,40],['Vega Castings','Medium',null,90]];
  for(const [party,status,terms,days] of expected){
    const supplier=data.suppliers.find(s=>s.supplier===party)!;assert.equal(supplier.msme_status,status);assert.equal(supplier.written_credit_days,terms);
    const rows=data.entries.filter(e=>e.ledger===party),bill=rows.find(e=>e.voucher_type==='Purchase')!;
    if(days===null){assert.equal(rows.length,1);assert.equal((Date.parse('2026-03-31T00:00:00+05:30')-Date.parse(bill.date))/86400000,52);}
    else {const payment=rows.find(e=>e.narration===`Payment against invoice ${bill.voucher_no}`)!;assert.equal((Date.parse(payment.date)-Date.parse(bill.date))/86400000,days);assert.equal(payment.dr,bill.cr);}
    if(party==='Bharat Fasteners') {
      assert.equal(bill.cr,56000000);
      const bills=rows.filter(e=>e.voucher_type==='Purchase'); assert.equal(bills.length,10);
      const ages=bills.map(b=>(Date.parse(rows.find(e=>e.narration===`Payment against invoice ${b.voucher_no}`)!.date)-Date.parse(b.date))/86400000);
      assert.equal(ages.filter(a=>a===68).length,1);assert.equal(ages.filter(a=>a===30).length,9);
    }
  }
});
test('term loan has 12 monthly principal payments and no current-maturities ledger',()=>{
  const rows=data.entries.filter(e=>e.ledger==='Meridian Co-operative Bank Term Loan'&&e.voucher_type==='Payment');
  assert.equal(rows.length,12);assert.equal(new Set(rows.map(e=>e.date.slice(0,7))).size,12);assert.ok(rows.every(e=>e.dr===200000000));
  assert.ok(!data.ledgers.some(l=>/current maturit/i.test(l.ledger_name)));
});
test('regeneration matches frozen SHA256SUMS and committed bytes',async()=>{
  // Temp folder stays inside the repository, also on Linux.
  const temp=await mkdtemp(resolve('.synthetic-test-'));
  try{
    await generateSynthetic(temp);
    const sums=await readFile('data/synthetic/SHA256SUMS','utf8');
    assert.equal(await readFile(join(temp,'data/synthetic/SHA256SUMS'),'utf8'),sums);
    for(const line of sums.trim().split('\n')){
      const [hash,name]=line.split('  ');const regenerated=await readFile(join(temp,'data/synthetic',name));
      assert.equal(createHash('sha256').update(regenerated).digest('hex'),hash);
      assert.deepEqual(regenerated,await readFile(join('data/synthetic',name)));
      assert.notEqual(regenerated.subarray(0,3).toString('hex'),'efbbbf');assert.ok(!regenerated.includes(13));
    }
    for(const name of ['planted.json','div1-mapping.csv']) assert.deepEqual(await readFile(join(temp,'data/answer-key',name)),await readFile(join('data/answer-key',name)));
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('synthetic files exclude fixed real-company list; CSVs contain no answer labels',async()=>{
  const banned=['Metro Bank','Union Bank','DGFT','Northstar Bank','Apex Motors','Shield General Insurance','Tata','HDFC','ICICI','SBI','Maruti Suzuki','Kirloskar','Deloitte','LIC','Marathwada Auto Compo','IM Gears'];
  for(const name of await readdir('data/synthetic')){
    const text=await readFile(join('data/synthetic',name),'utf8');
    for(const term of banned) assert.ok(!text.toLowerCase().includes(term.toLowerCase()),`${name}: ${term}`);
    if(name.endsWith('.csv')) assert.doesNotMatch(text,/\bR[1-5]\b|planted|decoy/i);
  }
});
test('CSV codec round-trips commas, quotes, embedded newlines and empty values',()=>{
  const rows=[{a:'a,"b"',b:'first\nsecond'},{a:'',b:''}];assert.deepEqual(readCsv(writeCsv(['a','b'],rows)),rows);
  assert.throws(()=>readCsv('a,b\n"bad,x\n'));assert.throws(()=>readCsv('a,b\none\n'));assert.throws(()=>numberFromCsv('1.5'));assert.throws(()=>numberFromCsv('-1'));assert.throws(()=>numberFromCsv('9007199254740992'));
});
for(const value of [undefined,'','true','prod','dev-only'])test(`seed guard ${JSON.stringify(value)??'missing'}`,()=>{
  if(value==='dev-only')assert.doesNotThrow(()=>assertSeedAllowed({SEED_ALLOWED:value}));
  else assert.throws(()=>assertSeedAllowed({SEED_ALLOWED:value}),{message:'Seeding refused: SEED_ALLOWED is not set on this deployment.'});
});
test('upsert plans preserve contents and counts on a second complete load',()=>{
  function twice<T>(rows:T[],key:(r:T)=>string){const first=planUpserts([],rows,key),second=planUpserts(first.rows,rows,key);assert.equal(first.inserts.length,rows.length);assert.deepEqual(second.rows,first.rows);assert.deepEqual(second.inserts,[]);assert.deepEqual(second.updates,[]);}
  twice(data.ledgers,l=>l.ledger_name);twice(data.entries,entryKey);twice(data.suppliers,s=>s.supplier);twice([data.company],c=>c.name);
});
test('upsert plan updates changed contents, retains unrelated rows, rejects duplicate keys',()=>{
  const before=[{name:'a',value:1},{name:'b',value:3}];const plan=planUpserts(before,[{name:'a',value:2}],r=>r.name);
  assert.deepEqual(plan.updates,[{name:'a',value:2}]);assert.equal(plan.rows.length,2);assert.deepEqual(before,[{name:'a',value:1},{name:'b',value:3}]);
  assert.throws(()=>planUpserts([],before.concat(before),r=>r.name));assert.throws(()=>planUpserts(before.concat(before),[],r=>r.name));
});
