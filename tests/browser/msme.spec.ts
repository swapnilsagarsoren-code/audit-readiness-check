import {test,expect} from '@playwright/test';
const row={flagKey:'R2:Delta Rubber',ruleId:'R2',party:'Delta Rubber',ledger:'Delta Rubber',amount:800000000/10,band:'below',percentOfFlagLine:35,related:false,statusKnown:true,note:'',entryRefs:[{voucher_no:'NF-00032',ledger:'Delta Rubber'}],ruleVersion:'RULES_v1-gateA',rank:0};
const list={materiality:{overall:450000000,flagLine:225000000,hideBelow:22500000,basis:'pbt'},flags:[row]};
const summary={name:'Northfield Auto Components Pvt Ltd',fy:'FY2025-26',ledgerCount:60,voucherCount:1250,dr:16000000000,cr:16000000000};
const b=(pairs:[string,string][])=>pairs.map(([value,label])=>({value,label}));
const bill={voucher_no:'NF-00032',ledger:'Delta Rubber',billDate:'2025-06-01',amount:80000000,paidDate:'2025-07-01',daysLate:15};
const base={
  flag:{flagKey:'R2:Delta Rubber',party:'Delta Rubber',amount:80000000,band:'below',statusKnown:true},supplier:{status:'Small',writtenDays:null},bills:[bill],allowed:15,
  context:'The books show 1 bill from Delta Rubber, totalling ₹8,00,000. The bill dated 1 June 2025 was paid on 1 July 2025, 30 days after the bill date. The supplier master records the size as Small and no written credit terms.',
  followups:[
    {id:'certificate',question:'Is the Udyam registration certificate for Delta Rubber on file?',buttons:b([['yes','Yes, on file'],['no','No'],['not_sure','Not sure']])},
    {id:'size',question:'What size does it show?',onlyWhen:{certificate:'yes'},buttons:b([['micro','Micro'],['small','Small'],['medium','Medium'],['not_registered','Not registered'],['not_sure','Not sure']])},
    {id:'terms',question:'Are the credit terms in writing?',buttons:b([['none','None in writing'],['up_to_15','Up to 15 days'],['up_to_30','Up to 30 days'],['up_to_45','Up to 45 days'],['over_45','More than 45 days']])},
  ],
  evidence:[{id:'R2-UDYAM',label:'Udyam registration certificate'},{id:'R2-CREDIT-TERMS',label:'Written credit terms (PO / agreement)'}],
};
const snapshot={kind:'interest_due',allowed:15,principal:80000000,interest:567123,bankRate:{value:5.75,date:'2026-10-20',sourceUrl:'https://www.rbi.org.in/'},bills:[{...bill,interest:567123}],
  notes:['Interest accrues on each late bill (MSMED Act s.16); controller to confirm the dates and the rate.','This screen does not record an agreed interest rate, so the rate under MSMED Act s.16 is applied: three times the RBI Bank Rate (5.75%, as listed on rbi.org.in on 20 October 2026). Indicative: monthly rests, current rate only, controller to confirm.']};
for(const width of [390,1440]) {
  test(`R2 gap detail flow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    let answered=false,decided:string|null=null;
    await page.route('https://m0-browser-test.convex.cloud/**',async route=>{
      const body=JSON.parse(route.request().postData()??'{}') as {path?:string;args?:unknown};
      const path=body.path??'',args=(Array.isArray(body.args)?body.args[0]:body.args) as Record<string,string>;
      let value:unknown=null;
      if(path==='flags:list') value=list;
      else if(path==='summary:get') value=summary;
      else if(path==='msme:detail') value={...base,answer:answered?{certificate:'yes',size:'small',terms:'none'}:null,snapshot:answered?snapshot:null,decision:decided?{decision:decided,decidedAt:1}:null};
      else if(path==='msme:record') {answered=true;value={ok:true};}
      else if(path==='msme:decide') {decided=args.decision;value={ok:true};}
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',value,logLines:[]})});
    });
    async function layout(){
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
      for(const target of await page.locator('button,a[href],input').all()){const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(43.5);}
    }
    await page.goto('/');
    await page.getByRole('link',{name:/Delta Rubber/}).click();
    await expect(page.getByRole('heading',{name:'Delta Rubber'})).toBeVisible();
    await expect(page.getByText('15 days late')).toBeVisible();
    await expect(page.getByText('What size does it show?')).toHaveCount(0);
    await layout();
    await page.getByRole('button',{name:'Yes, on file'}).click();
    await expect(page.getByText('What size does it show?')).toBeVisible();
    await page.getByRole('button',{name:'Small',exact:true}).click();
    await page.getByRole('button',{name:'None in writing'}).click();
    await page.getByLabel('Edit passcode').fill('a-passcode');
    await page.getByRole('button',{name:'Save answer'}).click();
    await expect(page.getByText('Late bills and interest')).toBeVisible();
    await expect(page.getByText('₹5,671.23').first()).toBeVisible();
    await expect(page.getByText('This screen does not record an agreed interest rate, so the rate under MSMED Act s.16 is applied')).toBeVisible();
    await layout();
    await page.getByRole('button',{name:'Approve',exact:true}).click();
    await expect(page.locator('.decision')).toHaveText('Approved');
    await layout();
  });
}
