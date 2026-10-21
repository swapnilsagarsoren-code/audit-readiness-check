import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { writeCsv } from '../shared/csv.ts';
import { trialBalance, type Ledger, type Entry, type Supplier } from '../shared/accounting.ts';

export const SEED = 202526;
function mulberry32(seed: number) {
  return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const lakh = 10_000_000; // integer paise
const iso = (day: string) => `${day}T00:00:00+05:30`;
const dayAfter = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const monthDay = (i: number, day = '10') => `${i < 9 ? 2025 : 2026}-${String((i + 3) % 12 + 1).padStart(2, '0')}-${day}`;
type Case = { id: string; rule: string; ledger: string; party: string; voucher_nos: string[]; voucher_count: number; amount: number; kind: 'planted' | 'decoy'; theme: string; facet: string; correct_option: string; correct_outcome: string; expected_impact_paise: number | null; impact_note: string; asset_book_value_paise?: number; asset_original_cost_paise?: number; asset_accumulated_depreciation_paise?: number };
export function buildSynthetic() {
  const random = mulberry32(SEED), ledgers: Ledger[] = [], entries: Entry[] = [], suppliers: Supplier[] = [], cases: Case[] = [];
  const mapping: Record<string, string> = {};
  function ledger(name: string, group: string, head: string, opening_dr = 0, opening_cr = 0) {
    ledgers.push({ ledger_name: name, tally_group: group, opening_dr, opening_cr }); mapping[name] = head;
  }
  const bank = 'Corvel Bank Current Account', sales = 'Sales - Components', repairs = 'Repairs & Maintenance', purchases = 'Raw Material Purchases';
  ledger(bank, 'Bank Accounts', 'Cash and cash equivalents', 10 * lakh);
  ledger('Equity Share Capital', 'Capital Account', 'Share capital', 0, 200 * lakh);
  ledger(sales, 'Sales Accounts', 'Revenue from operations');
  ledger(repairs, 'Indirect Expenses', 'Other expenses');
  ledger(purchases, 'Purchase Accounts', 'Cost of materials consumed');
  ledger('Subcontract Processing Charges', 'Direct Expenses', 'Other expenses');
  ledger('Inventory Change', 'Direct Expenses', 'Changes in inventories');
  const people: [string,string][] = [['Rajesh Mehta','Sundry Creditors'],['Anita Mehta','Unsecured Loans'],['Mehta Family Trust','Sundry Creditors'],['Sharma Traders','Sundry Creditors']];
  for (const [name, group] of people) ledger(name, group, group==='Unsecured Loans'?'Long-term borrowings':'Short-term borrowings');
  for (const name of ['Kaveri Steel Traders','Lotus Paints','Bharat Fasteners','Delta Rubber','Kumar Packaging','Sai Precision Springs','Vega Castings']) ledger(name,'Sundry Creditors','Trade payables');
  const loan = 'Meridian Co-operative Bank Term Loan', cc = 'Unity Commercial Bank Cash Credit';
  ledger(loan,'Secured Loans','Long-term borrowings; current portion: Short-term borrowings');
  ledger(cc,'Bank OD A/c','Short-term borrowings');
  const extra: [string,string,string][] = [
    ['Land','Fixed Assets','Property, plant and equipment'],['Factory Building','Fixed Assets','Property, plant and equipment'],['Plant & Machinery','Fixed Assets','Property, plant and equipment'],['Vehicles','Fixed Assets','Property, plant and equipment'],['Office Equipment','Fixed Assets','Property, plant and equipment'],['Furniture','Fixed Assets','Property, plant and equipment'],['Accumulated Depreciation','Fixed Assets','Property, plant and equipment (deduction)'],['Capital Work in Progress','Fixed Assets','Capital work-in-progress'],['Software','Fixed Assets','Intangible assets'],['Raw Material Inventory','Stock-in-Hand','Inventories'],['Work in Progress Inventory','Stock-in-Hand','Inventories'],['Finished Goods Inventory','Stock-in-Hand','Inventories'],['Stores Inventory','Stock-in-Hand','Inventories'],['Corvel Bank Fixed Deposit','Deposits (Asset)','Other bank balances'],['Cash in Hand','Cash-in-Hand','Cash and cash equivalents'],['Employee Advances','Loans & Advances (Asset)','Short-term loans and advances'],['Supplier Advances','Loans & Advances (Asset)','Short-term loans and advances'],['Security Deposits','Deposits (Asset)','Long-term loans and advances'],['Prepaid Insurance','Current Assets','Other current assets'],['Input GST','Duties & Taxes','Other current assets'],['Output GST','Duties & Taxes','Other current liabilities'],['TDS Payable','Duties & Taxes','Other current liabilities'],['Salary Payable','Current Liabilities','Other current liabilities'],['Audit Fee Payable','Current Liabilities','Other current liabilities'],['Leave Provision','Provisions','Short-term provisions'],['Retained Earnings','Reserves & Surplus','Reserves and surplus'],['Wages','Direct Expenses','Employee benefits expense'],['Electricity','Direct Expenses','Other expenses'],['Freight Inward','Direct Expenses','Other expenses'],['Salaries','Indirect Expenses','Employee benefits expense'],['Rent','Indirect Expenses','Other expenses'],['Insurance Expense','Indirect Expenses','Other expenses'],['Professional Fees','Indirect Expenses','Other expenses'],['Bank Charges','Indirect Expenses','Finance costs'],['Depreciation','Indirect Expenses','Depreciation and amortisation expense'],['Loan Interest','Indirect Expenses','Finance costs'],['Office Supplies','Indirect Expenses','Other expenses'],['Travel Expense','Indirect Expenses','Other expenses'],['Other Income','Indirect Incomes','Other income'],['Zenvar Motors Ltd','Sundry Debtors','Trade receivables'],['Fenmora Components Ltd','Sundry Debtors','Trade receivables']
  ];
  for (const row of extra) ledger(...row);
  let serial = 0;
  function voucher(date: string, type: string, debit: string, credit: string, amount: number, party: string, narration: string) {
    const no = `NF-${String(++serial).padStart(5, '0')}`;
    const common = { date: iso(date), voucher_no: no, voucher_type: type, party, narration, entered_by: `accounts0${1 + serial % 3}`, entered_at: `${date}T${String(9 + Math.floor(random() * 9)).padStart(2,'0')}:${String(Math.floor(random() * 60)).padStart(2,'0')}:00+05:30` };
    entries.push({ ...common, ledger: debit, dr: amount, cr: 0 }, { ...common, ledger: credit, dr: 0, cr: amount }); return no;
  }
  function addCase(id: string, rule: string, ledger: string, party: string, amount: number, nos: string[], kind: 'planted'|'decoy', option: string, outcome: string, impact: number|null = null, note = 'Requires later rule inputs; no estimated interest, tax, depreciation or book value invented.') {
    const theme = rule === 'R2' ? '8' : rule === 'R3' ? '3' : rule === 'R4' ? '4' : '2';
    cases.push({ id, rule, ledger, party, amount, voucher_nos: nos, voucher_count: nos.length, kind, theme, facet: theme === '8' ? '8a' : theme === '3' ? '3c' : theme === '4' ? '4a' : '2c', correct_option: option, correct_outcome: outcome, expected_impact_paise: impact, impact_note: note });
  }
  const receipts: [string,number[],string][] = [['Rajesh Mehta',[100,100,50],'temporary funds from MD'],['Anita Mehta',[60],'loan recd'],['Mehta Family Trust',[50],'recd for working capital'],['Sharma Traders',[5,5],'funds received by NEFT']];
  receipts.forEach(([party, amounts, narration], i) => {
    const nos = amounts.map((a,j) => voucher(monthDay(j,'05'),'Receipt',bank,party,a*lakh,party,narration));
    addCase(`P${i+1}`,'R1',party,party,amounts.reduce((a,b)=>a+b,0)*lakh,nos,'planted','Loan',party==='Anita Mehta' ? 'Already in borrowings; related-party disclosure and terms review' : 'Reclass trade payables to borrowings; terms and relationship require confirmation',party==='Anita Mehta'?0:amounts.reduce((a,b)=>a+b,0)*lakh,'Reclassification principal only; related-party and repayment terms remain separate questions.');
  });
  function bill(party: string, amount: number, date: string, days: number|null, status: string, terms: number|null, narration: string) {
    if (!suppliers.some(s=>s.supplier===party)) suppliers.push({supplier:party,msme_status:status,written_credit_days:terms});
    const no = voucher(date,'Purchase',purchases,party,amount,party,narration);
    const nos = [no];
    if (days!==null) nos.push(voucher(dayAfter(date,days),'Payment',party,bank,amount,party,`Payment against invoice ${no}`));
    return nos;
  }
  for (const [i,party,amount] of [[1,'Kaveri Steel Traders',10],[2,'Lotus Paints',5]] as const) {
    const nos=bill(party,amount*lakh,'2025-05-01',20,'Not registered',30,'Purchase of production materials');
    addCase(`D${i}`,'R1',party,party,amount*lakh,nos,'decoy','Goods/services supplied','No change',0,'Invoice and matching payment, principal counted once.');
  }
  const bharat: string[]=[];
  for(let i=0;i<10;i++) bharat.push(...bill('Bharat Fasteners',56*lakh/10,monthDay(i,'01'),i===0?68:30,'Micro',45,'Purchase of fasteners'));
  addCase('P5','R2','Bharat Fasteners','Bharat Fasteners',56*lakh,bharat,'planted','Micro','One bill paid at day 68; interest requires dated RBI Bank Rate');
  const billCases: [string,string,number,string,number|null,string,number|null,string][] = [
    ['P6','Delta Rubber',8,'2025-06-01',30,'Small',null,'Small'],['P7','Kumar Packaging',1.9,'2026-02-07',null,'',null,'Unknown'],['D3','Sai Precision Springs',6,'2025-07-01',40,'Micro',45,'Micro'],['D4','Vega Castings',12,'2025-08-01',90,'Medium',null,'Medium']
  ];
  for(const [id,party,amount,date,days,status,terms,option] of billCases){
    const nos=bill(party,Math.round(amount*lakh),date,days,status,terms,'Purchase of production materials');
    addCase(id,'R2',party,party,Math.round(amount*lakh),nos,id.startsWith('D')?'decoy':'planted',option,id==='P7'?'Unknown → ask for Udyam status':id==='D3'?'Paid within written terms; no MSMED interest':id==='D4'?'Medium; no MSMED interest':'Paid at day 30 without written terms; interest requires dated RBI Bank Rate',id.startsWith('D')?0:null);
  }
  const loanNo=voucher('2025-04-01','Receipt',bank,loan,1200*lakh,'Meridian Co-operative Bank','Term loan received; 60 monthly instalments from Apr 2025');
  addCase('P8','R3',loan,'Meridian Co-operative Bank',1200*lakh,[loanNo],'planted','Due within 12 months','Current maturities under short-term borrowings',240*lakh,'Synthetic equal principal of 20 lakh monthly; original principal 12 crore, closing 9.6 crore after 12 payments. Interest rate unspecified.');
  for(let i=0;i<12;i++) cases.find(c=>c.id==='P8')!.voucher_nos.push(voucher(monthDay(i,'28'),'Payment',loan,bank,20*lakh,'Meridian Co-operative Bank','Monthly term-loan principal instalment'));
  cases.find(c=>c.id==='P8')!.voucher_count=13;
  addCase('D5','R3',cc,'Unity Commercial Bank',110*lakh,[voucher('2025-04-02','Receipt',bank,cc,110*lakh,'Unity Commercial Bank','Cash credit drawdown')],'decoy','Repayable on demand','Already short-term borrowings',0);
  const repairCases: [string,string,number,string,string][] = [['P9','Kaveri Machine Tools',38,'new spindle assembly installed on VMC-3','Replaces a whole major part'],['P10','Om Constructions',120,'construction of new shed – running bill 2','Part of a project still being built'],['P11','Arena Motors',22,'purchase of new MPV for sales team','New asset'],['D6','Shree Engineering Works',0.45,'quarterly servicing – compressor','Routine upkeep'],['D7','Colour Craft Painters',3,'repainting of office','Routine upkeep']];
  for(const [id,party,a,narration,option] of repairCases) {
    suppliers.push({supplier:party,msme_status:'Not registered',written_credit_days:null});
    addCase(id,'R4',repairs,party,Math.round(a*lakh),[voucher('2025-09-15','Payment',repairs,bank,Math.round(a*lakh),party,narration)],id.startsWith('D')?'decoy':'planted',option,id.startsWith('D')?'No change':id==='P10'?'Capitalise to CWIP':'Capitalise to PPE; depreciation needs ready date and useful life',id.startsWith('D')?0:id==='P10'?a*lakh:null);
  }
  const incomeCases: [string,number,string,string,string][] = [['Gupta Scrap Dealers',45,'sale of MS scrap','Manufacturing scrap','Other operating revenue within revenue from operations'],['Kestrel General Insurance',30,'claim recd – fire at stores','Insurance claim','TBC in RULES_v1 before M2'],['Export Incentive Authority',25,'RoDTEP credit','Export incentive','TBC in RULES_v1 before M2'],['Meridian Co-operative Bank',12,'FD interest','Interest','Other income; citation TBC before M2'],['Corvel Bank',9,'exchange gain on USD receivable','Foreign-exchange gain','Other income'],['Patel Enterprises',40,'sale of old lathe machine','Sale of a fixed asset','Other income for gain of 20 lakh; remove old lathe book value of 20 lakh']];
  incomeCases.forEach(([party,a,narration,option,outcome],i)=>addCase(`P${12+i}`,'R5',sales,party,a*lakh,[voucher('2025-11-12','Receipt',bank,sales,a*lakh,party,narration)],'planted',option,outcome,i===0?0:i===3||i===4?a*lakh:null,i===0?'Within revenue from operations; product-sales classification changes by 45 lakh.':'Gross receipt is known; unresolved classification or book value is not invented.'));
  Object.assign(cases.find(c=>c.id==='P17')!, {asset_book_value_paise:20*lakh,asset_original_cost_paise:60*lakh,asset_accumulated_depreciation_paise:40*lakh,expected_impact_paise:-20*lakh,impact_note:'Synthetic old lathe within opening Plant & Machinery: cost 60 lakh less accumulated depreciation 40 lakh = book value 20 lakh. Removing book value lowers as-booked PBT by 20 lakh; sale proceeds remain 40 lakh.'});
  const zenvar:string[]=[];
  for(let i=0;i<12;i++) {
    const no=voucher(monthDay(i,'15'),'Sales','Zenvar Motors Ltd',sales,350*lakh,'Zenvar Motors Ltd','Sale of brake and suspension components'); zenvar.push(no);
    voucher(monthDay(i,'25'),'Receipt',bank,'Zenvar Motors Ltd',350*lakh,'Zenvar Motors Ltd',`Receipt against invoice ${no}`);
  }
  addCase('D8','R5',sales,'Zenvar Motors Ltd',4200*lakh,zenvar,'decoy','Sale of products','No change',0);
  // Addendum A: normal operating activity; every allocation is integer paise.
  const crore = 100 * lakh;
  function split(total: number, count: number) {
    const weights = Array.from({length:count},()=>80+Math.floor(random()*41));
    const weightTotal = weights.reduce((a,b)=>a+b,0);
    const values = weights.map(w=>Math.floor(total*w/weightTotal));
    values[values.length-1] += total-values.reduce((a,b)=>a+b,0);
    return values;
  }
  function opening(name:string, dr:number, cr=0) {
    const l=ledgers.find(l=>l.ledger_name===name)!; l.opening_dr=dr; l.opening_cr=cr;
  }
  const customers=['Fenmora Components Ltd','Belvora Automotive Ltd','Cenvira Assemblies Ltd','Dalmora Mobility Ltd','Elvanta Parts Ltd','Fervani Systems Ltd','Galmira Vehicles Ltd','Henvora Components Ltd','Irvana Assemblies Ltd'];
  for(const name of customers.slice(1)) ledger(name,'Sundry Debtors','Trade receivables');
  const materialVendors=['Talvori Equipment Works','Elvani Civil Works','Avrenda Metals','Belnori Alloys','Cervana Castings','Denvori Forgings','Elnara Bearings','Farsena Tubes','Gervani Plates','Helvora Rods','Ilnori Springs','Jervana Seals','Kelvori Fasteners','Lenvira Rubber','Mervani Packaging','Nolvara Steels','Orvani Wires','Pelnora Coatings','Quervani Plastics','Renvora Tools'];
  const serviceVendors=['Avenor Utilities','Tervana Logistics','Neravo Facility Services','Velora Advisory Services'];
  for(const [i,name] of [...materialVendors,...serviceVendors].entries()) {
    ledger(name,'Sundry Creditors','Trade payables');
    suppliers.push({supplier:name,msme_status:i%2?'Not registered':'Medium',written_credit_days:55});
  }
  // Demand facility is already current and has no term-loan cue in its name.
  ledger('Unity Commercial Bank WCDL','Bank OD A/c','Short-term borrowings',0,10*crore);
  for(const [name,amount] of [['Land',5],['Factory Building',10],['Plant & Machinery',25],['Vehicles',3],['Office Equipment',1],['Furniture',1]] as const) opening(name,amount*crore);
  opening('Accumulated Depreciation',0,27*crore);
  const stockOpening: [string,number][]=[['Raw Material Inventory',4.5*crore],['Work in Progress Inventory',crore],['Finished Goods Inventory',2*crore],['Stores Inventory',0.5*crore]];
  for(const [name,amount] of stockOpening) opening(name,amount);
  opening('Cash in Hand',10*lakh);
  opening('Zenvar Motors Ltd',1.4*crore);
  for(const name of customers) opening(name,40*lakh);
  for(const name of materialVendors) opening(name,0,75*lakh);
  const netOpening=ledgers.reduce((sum,l)=>sum+l.opening_dr-l.opening_cr,0);
  if(netOpening<0) throw new Error('Opening retained earnings would be negative.');
  opening('Retained Earnings',0,netOpening);

  // Settle opening receivables and supplier invoices on explicit prior-year terms.
  voucher('2025-04-10','Receipt',bank,'Zenvar Motors Ltd',1.4*crore,'Zenvar Motors Ltd','Settlement of opening invoice dated 2025-03-31; 10-day terms');
  for(const name of customers) voucher('2025-04-16','Receipt',bank,name,40*lakh,name,'Settlement of opening invoice dated 2025-01-31; 75-day terms');
  for(const name of materialVendors) voucher('2025-04-25','Payment',name,bank,75*lakh,name,'Settlement of opening invoice dated 2025-03-01; 55-day terms');

  function supplierInvoice(date:string, expense:string, amount:number, party:string, narration:string) {
    const no=voucher(date,'Purchase',expense,party,amount,party,narration);
    const paymentDate=dayAfter(date,55);
    if(paymentDate<='2026-03-31') voucher(paymentDate,'Payment',party,bank,amount,party,`Payment against invoice ${no}`);
    return no;
  }
  // Genuine capex is correctly booked, separate from the unchanged repairs cases.
  supplierInvoice('2025-05-10','Plant & Machinery',3.5*crore,materialVendors[0],'Production equipment commissioned');
  supplierInvoice('2025-06-10','Factory Building',1.5*crore,materialVendors[1],'Factory extension completed and ready for use');
  voucher('2025-07-15','Contra','Corvel Bank Fixed Deposit',bank,40*lakh,'Corvel Bank','Transfer to bank fixed deposit');

  // Non-Zenvar customers have 75-day terms: Q4 invoices remain outstanding.
  const remainingRevenue=150*crore-trialBalance(ledgers,entries).revenue;
  const collectedSales=split(remainingRevenue-27*crore,9*customers.length*2);
  const outstandingSales=split(27*crore,3*customers.length*2);
  let collectedIndex=0,outstandingIndex=0;
  for(let month=0;month<12;month++) for(const customer of customers) for(const day of ['25','27']) {
    const amount=month<9?collectedSales[collectedIndex++]:outstandingSales[outstandingIndex++];
    const date=monthDay(month,day),no=voucher(date,'Sales',customer,sales,amount,customer,'Sale of precision parts');
    const received=dayAfter(date,75);
    if(received<='2026-03-31') voucher(received,'Receipt',bank,customer,amount,customer,`Receipt against invoice ${no}`);
  }

  // 21.9155 crore routine overhead, plus existing repairs and 0.4 crore accrual.
  // Final two months' supplier bills stay payable for their agreed 55 days.
  const overheads: [string,number,string][]=[['Electricity',420*lakh,'Power for factory operations'],['Freight Inward',300*lakh,'Inbound freight services'],['Rent',180*lakh,'Factory premises rent'],['Insurance Expense',90*lakh,'Annual coverage cost allocation'],['Repairs & Maintenance',120*lakh,'Routine servicing of production equipment'],['Professional Fees',100*lakh,'Accounting and compliance services'],['Travel Expense',80*lakh,'Business travel services'],['Office Supplies',60*lakh,'Office consumables'],['Subcontract Processing Charges',841.55*lakh,'Subcontract component processing']];
  for(const [index,[expense,total,narration]] of overheads.entries()) {
    const monthly=split(Math.round(total),12);
    for(let month=0;month<12;month++) supplierInvoice(monthDay(month,'05'),expense,monthly[month],serviceVendors[index%serviceVendors.length],narration);
  }
  // Total closing trade suppliers = 15.5 crore, including Kumar Packaging.
  const existingTrade=trialBalance(ledgers,entries).balances;
  const supplierBalance=suppliers.reduce((sum,s)=>sum-(existingTrade.get(s.supplier)??0),0);
  const unpaidMaterials=15.5*crore-supplierBalance;
  const materialsTarget=95.5*crore; // 8 crore opening + purchases - 9 crore closing = 94.5 crore consumed.
  const existingPurchases=entries.filter(e=>e.ledger===purchases).reduce((sum,e)=>sum+e.dr-e.cr,0);
  const remainingPurchases=materialsTarget-existingPurchases;
  if(unpaidMaterials<=0||unpaidMaterials>=remainingPurchases) throw new Error('Supplier balance allocation is infeasible.');
  const paidBills=split(remainingPurchases-unpaidMaterials,10*materialVendors.length),unpaidBills=split(unpaidMaterials,2*materialVendors.length);
  let paidIndex=0,unpaidIndex=0;
  for(let month=0;month<12;month++) for(const party of materialVendors) {
    supplierInvoice(monthDay(month,'10'),purchases,month<10?paidBills[paidIndex++]:unpaidBills[unpaidIndex++],party,'Purchase of production materials');
  }
  for(const [expense,total,party] of [['Wages',10.5*crore,'Production Payroll'],['Salaries',5.25*crore,'Office Payroll']] as const) {
    const monthly=split(total,12);
    for(let month=0;month<12;month++) {
      voucher(monthDay(month,'20'),'Journal',expense,'Salary Payable',monthly[month],party,'Monthly employee compensation');
      voucher(monthDay(month,'28'),'Payment','Salary Payable',bank,monthly[month],party,'Monthly payroll settlement');
    }
  }
  // Synthetic annual financing assumptions, not externally sourced rates.
  for(const [party,total] of [['Meridian Co-operative Bank',100*lakh],['Unity Commercial Bank',105.5*lakh],['Anita Mehta',4.5*lakh]] as const) {
    const monthly=split(total,12);
    for(let month=0;month<12;month++) voucher(monthDay(month,'28'),'Payment','Loan Interest',bank,monthly[month],party,'Monthly borrowing interest');
  }
  const openingAssetDepreciation=split(425*lakh,12);
  for(let month=0;month<12;month++) {
    voucher(monthDay(month,'28'),'Payment','Bank Charges',bank,1.25*lakh,'Corvel Bank','Monthly account service charges');
    voucher(monthDay(month,'28'),'Journal','Depreciation','Accumulated Depreciation',openingAssetDepreciation[month],'Asset Accounting','Monthly depreciation on opening asset base');
    if(month>=2) voucher(monthDay(month,'28'),'Journal','Depreciation','Accumulated Depreciation',2.5*lakh,'Asset Accounting','Monthly depreciation on commissioned additions');
  }
  for(const month of [2,5,8,11]) voucher(monthDay(month,'20'),'Receipt',bank,'Other Income',3.75*lakh,'Neravo Facility Services','Recovery of shared service charges');

  // One Tally-style year-end stock voucher reverses opening stock and records closing stock.
  const stockClosing=[5*crore,crore,2.5*crore,0.5*crore];
  const stockNo=`NF-${String(++serial).padStart(5,'0')}`;
  const stockCommon={date:iso('2026-03-31'),voucher_no:stockNo,voucher_type:'Journal',party:'Inventory Accounting',narration:'Year-end closing stock valuation',entered_by:'accounts03',entered_at:'2026-03-31T16:45:00+05:30'};
  stockOpening.forEach(([name,amount],i)=> {
    entries.push({...stockCommon,ledger:name,dr:0,cr:amount},{...stockCommon,ledger:name,dr:stockClosing[i],cr:0});
  });
  entries.push({...stockCommon,ledger:'Inventory Change',dr:8*crore,cr:0},{...stockCommon,ledger:'Inventory Change',dr:0,cr:9*crore});
  const balancingExpense=trialBalance(ledgers,entries).pbt-9*crore;
  if(balancingExpense<0||balancingExpense>50*lakh) throw new Error('Addendum A targets conflict: routine balancing provision exceeds 50 lakh.');
  voucher('2026-03-31','Journal','Professional Fees','Audit Fee Payable',balancingExpense,'Velora Advisory Services','Routine professional fee provision for the quarter');
  // Bridge seasonal cash needs with the same demand facility, repaid before year-end.
  // This changes payment timing, not closing debt, equity or the cost mix.
  const bankMovements=new Map<string,number>();
  for(const e of entries) if(e.ledger===bank) bankMovements.set(e.date.slice(0,10),(bankMovements.get(e.date.slice(0,10))??0)+e.dr-e.cr);
  bankMovements.set('2026-03-31',bankMovements.get('2026-03-31')??0);
  let bankBalance=ledgers.find(l=>l.ledger_name===bank)!.opening_dr,temporaryDraws=0;
  for(const [date,movement] of [...bankMovements].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    bankBalance+=movement;
    if(bankBalance<0.5*crore) {
      const draw=3*crore-bankBalance;
      voucher(date,'Contra',bank,'Unity Commercial Bank WCDL',draw,'Unity Commercial Bank','Working capital facility drawdown');
      bankBalance+=draw;temporaryDraws+=draw;
    }
    const reserve=date==='2026-03-31'?0.5*crore:3*crore;
    if((bankBalance>5*crore||date==='2026-03-31')&&temporaryDraws>0) {
      const repayment=Math.min(temporaryDraws,Math.max(0,bankBalance-reserve));
      if(repayment>0) voucher(date,'Contra','Unity Commercial Bank WCDL',bank,repayment,'Unity Commercial Bank','Working capital facility repayment');
      bankBalance-=repayment;temporaryDraws-=repayment;
    }
  }
  if(temporaryDraws!==0) throw new Error('Addendum A targets conflict: seasonal demand drawings remain at year-end.');
  addCase('D9','R3','Unity Commercial Bank WCDL','Unity Commercial Bank',10*crore,entries.filter(e=>e.ledger==='Unity Commercial Bank WCDL').map(e=>e.voucher_no),'decoy','Repayable on demand','Already short-term borrowings',0,'Opening and closing demand facility principal 10 crore; intra-year cash drawdowns are repaid.');
  entries.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.voucher_no<b.voucher_no?-1:a.voucher_no>b.voucher_no?1:0);
  const company={ name:'Northfield Auto Components Pvt Ltd', fy:'FY2025-26', start:iso('2025-04-01'), end:'2026-03-31T23:59:59+05:30', division:'I', description:'Fictional unlisted private manufacturer of brake and suspension parts', directors:['Rajesh Mehta','Sunita Rao'], relatives:[{name:'Anita Mehta',relationship:'Spouse of MD Rajesh Mehta'},{name:'Mehta Family Trust',relationship:'MD Rajesh Mehta is a trustee'}], shareholders:['Rajesh Mehta','Sunita Rao','Northfield Holdings Pvt Ltd'], taxRate:null, taxRateSource:'synthetic input; value not supplied', taxRateDate:null, materialityInputs:{revenueBasisPoints:100,pbtBasisPoints:500,flagBasisPoints:5000,trivialBasisPoints:500}, covenantThresholds:{currentRatio:1.2,debtEquity:1.5,source:'synthetic input'}, rbiBankRate:null, expectedLedgerCount:ledgers.length, expectedEntryCount:entries.length, expectedSupplierCount:suppliers.length };
  return {company,ledgers,entries,suppliers,cases,mapping,balancingExpense};
}
export async function generateSynthetic(root: string) {
  const d=buildSynthetic(), synthetic=resolve(root,'data/synthetic'), answers=resolve(root,'data/answer-key');
  await mkdir(synthetic,{recursive:true}); await mkdir(answers,{recursive:true});
  const files: Record<string,string>={
    'company.json':JSON.stringify(d.company,null,2)+'\n',
    'ledgers.csv':writeCsv(['ledger_name','tally_group','opening_dr','opening_cr'],d.ledgers),
    'daybook.csv':writeCsv(['date','voucher_no','voucher_type','ledger','dr','cr','party','narration','entered_by','entered_at'],d.entries),
    'suppliers.csv':writeCsv(['supplier','msme_status','written_credit_days'],d.suppliers),
  };
  for(const [name,contents] of Object.entries(files)) await writeFile(resolve(synthetic,name),contents,'utf8');
  await writeFile(resolve(synthetic,'SHA256SUMS'),Object.entries(files).map(([name,contents])=>`${createHash('sha256').update(contents,'utf8').digest('hex')}  ${name}\n`).join(''));
  await writeFile(resolve(answers,'planted.json'),JSON.stringify({seed:SEED,cases:d.cases},null,2)+'\n');
  await writeFile(resolve(answers,'div1-mapping.csv'),writeCsv(['ledger_name','division_i_head'],Object.entries(d.mapping).map(([ledger_name,division_i_head])=>({ledger_name,division_i_head}))));
  return d;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const d=await generateSynthetic(resolve(process.argv[2]??'.'));
  console.log(`Generated ${d.ledgers.length} ledgers, ${d.entries.length} entries, ${d.suppliers.length} suppliers.`);
}
