import {test,expect} from '@playwright/test';
const flags={materiality:{overall:450000000,flagLine:225000000,hideBelow:22500000,basis:'pbt'},flags:[
  {flagKey:'R3:Meridian Co-operative Bank Term Loan',ruleId:'R3',party:'Meridian Co-operative Bank',ledger:'Meridian Co-operative Bank Term Loan',amount:9600000000,band:'flagged',percentOfFlagLine:426,related:false,statusKnown:true,note:'',entryRefs:[{voucher_no:'NF-00039',ledger:'x'}],ruleVersion:'RULES_v1-gateA',rank:0},
  {flagKey:'R1:Sharma Traders',ruleId:'R1',party:'Sharma Traders',ledger:'Sharma Traders',amount:100000000,band:'below',percentOfFlagLine:44,related:false,statusKnown:true,note:'',entryRefs:[{voucher_no:'NF-00006',ledger:'x'}],ruleVersion:'RULES_v1-gateA',rank:1},
]};
const summary={name:'Northfield Auto Components Pvt Ltd',fy:'FY2025-26',ledgerCount:60,voucherCount:1250,dr:16000000000,cr:16000000000};
for(const width of [390,1440]) {
  test(`gaps list states and layout at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    let mode:'ready'|'done'|'empty'|'error'='ready';
    await page.route('https://m0-browser-test.convex.cloud/**',async route=>{
      const isFlags=(route.request().postData()??'').includes('flags:list');
      if(isFlags&&mode==='error') return route.fulfill({status:500,body:'Unavailable'});
      const value=isFlags?(mode==='empty'?null:mode==='done'?{...flags,flags:[]}:flags):summary;
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',value,logLines:[]})});
    });
    async function noSideScroll(){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);}
    await page.goto('/');
    const items=page.getByRole('list',{name:undefined}).locator('li.gap');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('Meridian Co-operative Bank');
    await expect(items.first()).toContainText('₹9,60,00,000');
    await expect(items.last()).toContainText('Below flag line');
    await expect(page.getByText('Overall materiality ₹45 lakh · Flag line ₹22.5 lakh')).toBeVisible();
    await noSideScroll();
    mode='done';await page.getByRole('button',{name:'Refresh'}).click();
    await expect(page.getByText('No gaps above the flag line.')).toBeVisible();await noSideScroll();
    mode='empty';await page.getByRole('button',{name:'Refresh'}).click();
    await expect(page.getByText("No gaps list yet. The books haven't been checked.")).toBeVisible();await noSideScroll();
    mode='error';await page.getByRole('button',{name:'Refresh'}).click();
    await expect(page.getByRole('alert')).toHaveText("Couldn't load the gaps list. Nothing here is final.");
    await expect(page.locator('li.gap')).toHaveCount(0);await noSideScroll();
  });
}
