import {test,expect} from '@playwright/test';
const flagRow={flagKey:'R1:Rajesh Mehta',ruleId:'R1',party:'Rajesh Mehta',ledger:'Rajesh Mehta',amount:25000000000,band:'flagged',percentOfFlagLine:11111,related:true,statusKnown:true,note:'',entryRefs:[{voucher_no:'NF-00001',ledger:'Rajesh Mehta'}],ruleVersion:'RULES_v1-gateA',rank:0};
const list={materiality:{overall:450000000,flagLine:225000000,hideBelow:22500000,basis:'pbt'},flags:[flagRow]};
const summary={name:'Northfield Auto Components Pvt Ltd',fy:'FY2025-26',ledgerCount:60,voucherCount:1250,dr:16000000000,cr:16000000000};
const buttons=(pairs:[string,string][])=>pairs.map(([value,label])=>({value,label}));
const base={
  flag:{flagKey:'R1:Rajesh Mehta',ledger:'Rajesh Mehta',party:'Rajesh Mehta',amount:25000000000,band:'flagged',related:true},
  entries:[{voucher_no:'NF-00001',date:'2025-04-05T00:00:00+05:30',amount:1000000000,narration:'temporary funds from MD'},{voucher_no:'NF-00002',date:'2025-05-05T00:00:00+05:30',amount:1000000000,narration:'temporary funds from MD'}],
  question:{context:"The books show 3 receipts from the bank into Rajesh Mehta's account, totalling ₹2,50,00,000, between 5 April 2025 and 5 June 2025. The narration reads 'temporary funds from MD'.",question:'What was this money received for?',text:''},
  natureButtons:buttons([['goods_services','Goods or services supplied'],['loan','Loan'],['advance','Advance against future supply'],['deposit','Security deposit'],['not_sure','Not sure']]),
  followups:[
    {id:'counterparty',question:'Who provided the money?',buttons:buttons([['director','Director'],['relative','Relative of a director'],['shareholder','Shareholder'],['group_company','Group company'],['other','Other'],['not_sure','Not sure']])},
    {id:'term',question:'When is it to be repaid?',buttons:buttons([['within_12_months','Within 12 months'],['after_12_months','After 12 months'],['on_demand','On demand or no terms']])},
    {id:'declaration',question:'Does the company hold a written declaration from them about the source of this money?',buttons:buttons([['yes','Yes'],['no','No'],['unknown','Not sure']]),onlyFor:['director','relative']},
  ],
  evidence:[{id:'R1-LOAN-AGREEMENT',label:'Loan agreement or letter stating terms'},{id:'R1-BANK-STATEMENT',label:'Bank statement lines for the receipts'}],
};
const snapshot={outcome:{kind:'reclass',caption:'Short-term borrowings: Loans and advances from related parties',entry:{debit:'Rajesh Mehta',credit:'Short-term borrowings: Loans and advances from related parties',amount:25000000000},relatedPartyDisclosure:true,legalReview:false,note:'Move from trade payables to borrowings. Related-party disclosure (AS 18): controller to confirm.'},
  before:{debt:213000000000,equity:152000000000,ratio:1.4013},after:{debt:238000000000,equity:152000000000,ratio:1.5658},covenantMax:1.5,covenantBefore:'within',covenantAfter:'breach'};
for(const width of [390,1440]) {
  test(`gap detail flow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    let answered=false,decided:string|null=null,recordReply:{ok:boolean;reason?:string}={ok:false,reason:'wrong'};
    const sent:string[]=[];
    await page.route('https://m0-browser-test.convex.cloud/**',async route=>{
      const body=JSON.parse(route.request().postData()??'{}') as {path?:string;args?:unknown};
      const path=body.path??'';
      let value:unknown=null;
      if(path==='flags:list') value=list;
      else if(path==='summary:get') value=summary;
      else if(path==='answers:detail') value={...base,answer:answered?{nature:'loan',counterparty:'director',term:'within_12_months',declaration:'yes'}:null,snapshot:answered?snapshot:null,decision:decided?{decision:decided,decidedAt:1}:null};
      else if(path==='answers:record') {sent.push(JSON.stringify(body.args));if(recordReply.ok) answered=true;value=recordReply;}
      else if(path==='answers:decide') {const a=(Array.isArray(body.args)?body.args[0]:body.args) as {decision:string};decided=a.decision;value={ok:true};}
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',value,logLines:[]})});
    });
    async function layout(){
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
      for(const target of await page.locator('button,a[href],input').all()){const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(43.5);}
    }
    await page.goto('/');
    await page.getByRole('link',{name:/Rajesh Mehta/}).click();
    await expect(page.getByRole('heading',{name:'Rajesh Mehta'})).toBeVisible();
    await expect(page.getByText('What the books show')).toBeVisible();
    await expect(page.getByText('What was this money received for?')).toBeVisible();
    await expect(page.getByText('Who provided the money?')).toHaveCount(0);
    await layout();
    await page.getByRole('button',{name:'Loan',exact:true}).click();
    await page.getByRole('button',{name:'Director',exact:true}).click();
    await page.getByRole('button',{name:'Within 12 months'}).click();
    await expect(page.getByText('Does the company hold a written declaration')).toBeVisible();
    await page.getByRole('button',{name:'Yes',exact:true}).click();
    await expect(page.getByRole('button',{name:'Save answer'})).toBeDisabled();
    await page.getByLabel('Edit passcode').fill('not-the-passcode');
    await page.getByRole('button',{name:'Save answer'}).click();
    await expect(page.getByText('That passcode is wrong.')).toBeVisible();
    await expect(page.getByText('Debt-equity, before and after')).toHaveCount(0);
    recordReply={ok:true};
    await page.getByRole('button',{name:'Save answer'}).click();
    await expect(page.getByText('Debt-equity, before and after')).toBeVisible();
    await expect(page.getByRole('cell',{name:'1.40'})).toBeVisible();
    await expect(page.getByRole('cell',{name:'1.57'})).toBeVisible();
    await expect(page.getByText('Above the 1.50 limit')).toBeVisible();
    await expect(page.getByText('Nothing is written to the books. This records your decision only.')).toBeVisible();
    expect(sent.every(s=>!s.includes('snapshot')&&s.includes('"nature":"loan"'))).toBe(true);
    await layout();
    await page.getByRole('button',{name:'Approve',exact:true}).click();
    await expect(page.locator('.decision')).toHaveText('Approved');
    await expect(page.locator('.story-go')).toHaveCount(0);
    await layout();
    await page.getByRole('link',{name:'← All gaps'}).click();
    await expect(page.getByRole('heading',{name:'Gaps an auditor is likely to raise'})).toBeVisible();
  });
}
