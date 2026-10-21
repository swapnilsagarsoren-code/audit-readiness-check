import {test,expect} from '@playwright/test';
for(const width of [390,1440]) {
  test(`placeholder states and layout at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    let mode:'loading'|'ready'|'error'|'empty'|'unbalanced'='loading';
    const summary={name:'Northfield Auto Components Pvt Ltd',fy:'FY2025-26',ledgerCount:60,voucherCount:1250,dr:16000000000,cr:16000000000};
    // Explicit HTTP fixtures exercise UI states; this does not certify cloud seeding.
    await page.route('https://m0-browser-test.convex.cloud/**',async route=>{
      if(mode==='loading') return route.abort(); // overridden below for the loading request
      if(mode==='error') return route.fulfill({status:500,body:'Unavailable'});
      if((route.request().postData()??'').includes('flags:list')) return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',value:null,logLines:[]})});
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',value:mode==='empty'?null:{...summary,cr:mode==='unbalanced'?summary.cr-100:summary.cr},logLines:[]})});
    });
    let release!:()=>void;
    const waiting=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/query',async route=>{
      if(mode==='loading') {await waiting;}
      await route.fallback();
    });
    await page.goto('/');
    await expect(page.getByText('Loading company data…')).toBeVisible();
    await expect(page.locator('dd')).toHaveText(['—','—','—','—']);
    await expect(page.getByTestId('balanced')).toBeEmpty();
    async function layout(){
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
      const targets=page.locator('button,a[href],input,select,textarea,[role="button"]');
      expect(await targets.count()).toBeGreaterThan(0);
      for(const target of await targets.all()){const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);}
    }
    await layout(); mode='ready';release();
    await expect(page.getByTestId('balanced')).toHaveText('TB balanced: yes');
    await expect(page.locator('dd').first()).toHaveText('60'); await layout();
    mode='unbalanced';await page.getByRole('button',{name:'Refresh'}).click();
    await expect(page.getByTestId('balanced')).toHaveText('TB balanced: no');await layout();
    mode='empty';await page.getByRole('button',{name:'Refresh'}).click();
    await expect(page.getByText('Company data is not ready yet.')).toBeVisible();await expect(page.getByTestId('balanced')).toBeEmpty();await layout();
    mode='error';await page.getByRole('button',{name:'Refresh'}).click();
    await expect(page.getByRole('alert').filter({hasText:"Couldn't load data."})).toHaveText("Couldn't load data. Nothing here is final.");
    await expect(page.locator('dd')).toHaveText(['—','—','—','—']);await expect(page.getByTestId('balanced')).toBeEmpty();await layout();
  });
}
