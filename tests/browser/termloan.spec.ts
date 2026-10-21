import {test,expect} from '@playwright/test';
const row={flagKey:'R3:Meridian Co-operative Bank Term Loan',ruleId:'R3',party:'Meridian Co-operative Bank',ledger:'Meridian Co-operative Bank Term Loan',amount:9600000000,band:'flagged',percentOfFlagLine:4266,related:false,statusKnown:true,note:'',entryRefs:[{voucher_no:'NF-00039',ledger:'x'}],ruleVersion:'RULES_v1-gateA',rank:0};
const list={materiality:{overall:450000000,flagLine:225000000,hideBelow:22500000,basis:'pbt'},flags:[row]};
const summary={name:'Northfield Auto Components Pvt Ltd',fy:'FY2025-26',ledgerCount:60,voucherCount:1250,dr:16000000000,cr:16000000000};
const base={
  flag:{flagKey:row.flagKey,party:row.party,ledger:row.ledger,amount:row.amount,band:'flagged'},
  context:'The books show a term loan from Meridian Co-operative Bank with a closing balance of ₹9,60,00,000. The loan was received on 1 April 2025 with 60 monthly instalments, and 12 principal instalments of ₹20,00,000 have been paid. There is no current-maturities ledger.',
  question:{question:'Are the sanction letter and the repayment schedule on file?',buttons:[['both','Both on file'],['sanction_only','Only the sanction letter'],['schedule_only','Only the repayment schedule'],['neither','Neither'],['not_sure','Not sure']].map(([value,label])=>({value,label}))},
  evidence:[{id:'R3-SANCTION',label:'Sanction letter'},{id:'R3-REPAYMENT-SCHEDULE',label:'Repayment schedule'}],
};
const snapshot={kind:'split',split:{balance:9600000000,totalInstalments:60,paid:12,remaining:48,instalment:200000000,due12:2400000000},
  entry:{debit:row.ledger,credit:'Current maturities of long-term borrowings',amount:2400000000},
  currentBefore:{assets:37000000000,liabilities:30100000000,ratio:1.2292},currentAfter:{assets:37000000000,liabilities:32500000000,ratio:1.1385},covenantMin:1.2,covenantBefore:'within',covenantAfter:'breach',
  notes:['Show the part due within 12 months as "Current maturities of long-term borrowings" under short-term borrowings (Schedule III Division I); controller to confirm against the repayment schedule.']};
for(const width of [390,1440]) {
  test(`R3 gap detail flow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    let answered=false,decided:string|null=null;
    await page.route('https://m0-browser-test.convex.cloud/**',async route=>{
      const body=JSON.parse(route.request().postData()??'{}') as {path?:string;args?:unknown};
      const path=body.path??'',args=(Array.isArray(body.args)?body.args[0]:body.args) as Record<string,string>;
      let value:unknown=null;
      if(path==='flags:list') value=list;
      else if(path==='summary:get') value=summary;
      else if(path==='termloan:detail') value={...base,answer:answered?{documents:'both'}:null,snapshot:answered?snapshot:null,decision:decided?{decision:decided,decidedAt:1}:null};
      else if(path==='termloan:record') {answered=true;value={ok:true};}
      else if(path==='termloan:decide') {decided=args.decision;value={ok:true};}
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',value,logLines:[]})});
    });
    async function layout(){
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
      for(const target of await page.locator('button,a[href],input').all()){const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(43.5);}
    }
    await page.goto('/');
    await page.getByRole('link',{name:/Meridian Co-operative Bank/}).click();
    await expect(page.getByRole('heading',{name:'Meridian Co-operative Bank'})).toBeVisible();
    await expect(page.getByText('Are the sanction letter and the repayment schedule on file?')).toBeVisible();
    await layout();
    await page.getByRole('button',{name:'Both on file'}).click();
    await page.getByLabel('Edit passcode').fill('a-passcode');
    await page.getByRole('button',{name:'Save answer'}).click();
    await expect(page.getByText('Current ratio, before and after')).toBeVisible();
    await expect(page.getByRole('cell',{name:'1.23'})).toBeVisible();
    await expect(page.getByRole('cell',{name:'1.14'})).toBeVisible();
    await expect(page.getByText('Below the 1.20 floor')).toBeVisible();
    await layout();
    await page.getByRole('button',{name:'Approve',exact:true}).click();
    await expect(page.locator('.decision')).toHaveText('Approved');
    await layout();
  });
}
