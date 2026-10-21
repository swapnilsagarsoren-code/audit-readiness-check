import {test,expect,type Page} from '@playwright/test';
const b=(pairs:[string,string][])=>pairs.map(([value,label])=>({value,label}));
const r1={
  flag:{flagKey:'R1:Rajesh Mehta',ledger:'Rajesh Mehta',party:'Rajesh Mehta',amount:2500000000,band:'flagged',related:true},
  entries:[{voucher_no:'NF-00001',date:'2025-04-05T00:00:00+05:30',amount:1000000000,narration:'temporary funds from MD'}],
  question:{context:"The books show 3 receipts from the bank into Rajesh Mehta's account, totalling ₹2,50,00,000, between 5 April 2025 and 5 June 2025. The narration reads 'temporary funds from MD'.",question:'What was this money received for?',text:''},
  natureButtons:b([['goods_services','Goods or services supplied'],['loan','Loan'],['advance','Advance against future supply'],['deposit','Security deposit'],['not_sure','Not sure']]),
  followups:[
    {id:'counterparty',question:'Who provided the money?',buttons:b([['director','Director'],['relative','Relative of a director'],['shareholder','Shareholder'],['group_company','Group company'],['other','Other'],['not_sure','Not sure']])},
    {id:'term',question:'When is it to be repaid?',buttons:b([['within_12_months','Within 12 months'],['after_12_months','After 12 months'],['on_demand','On demand or no terms']])},
    {id:'declaration',question:'Does the company hold a written declaration from them about the source of this money?',buttons:b([['yes','Yes'],['no','No'],['unknown','Not sure']]),onlyFor:['director','relative']},
  ],
  evidence:[{id:'R1-LOAN-AGREEMENT',label:'Loan agreement or letter stating terms'}],
};
const r1Snapshot={outcome:{kind:'reclass',caption:'Short-term borrowings: Loans and advances from related parties',entry:{debit:'Rajesh Mehta',credit:'Short-term borrowings: Loans and advances from related parties',amount:2500000000},relatedPartyDisclosure:true,legalReview:false,note:'Move from trade payables to borrowings. Related-party disclosure (AS 18): controller to confirm.'},
  before:{debt:213000000000,equity:152000000000,ratio:1.4013},after:{debt:238000000000,equity:152000000000,ratio:1.5658},covenantMax:1.5,covenantBefore:'within',covenantAfter:'breach'};
const r2={
  flag:{flagKey:'R2:Delta Rubber',party:'Delta Rubber',amount:80000000,band:'below',statusKnown:true},supplier:{status:'Small',writtenDays:null},
  bills:[{voucher_no:'NF-00032',ledger:'Delta Rubber',billDate:'2025-06-01',amount:80000000,paidDate:'2025-07-01',daysLate:15}],allowed:15,
  context:'The books show 1 bill from Delta Rubber, totalling ₹8,00,000.',
  followups:[{id:'certificate',question:'Is the Udyam registration certificate for Delta Rubber on file?',buttons:b([['yes','Yes, on file'],['no','No'],['not_sure','Not sure']])}],
  evidence:[{id:'R2-UDYAM',label:'Udyam registration certificate'}],answer:null,snapshot:null,decision:null,
};
const rate={value:5.75,date:'2026-10-21',sourceUrl:'https://www.rbi.org.in/',checkedAt:Date.UTC(2026,9,21,10,28),lastDecision:'2026-10-07',next:{start:'2026-12-02',end:'2026-12-04'}};
const cards=[
  {flagKey:'R1:Rajesh Mehta',ruleId:'R1',title:'Whose money is this?',party:'Rajesh Mehta',amount:2500000000},
  {flagKey:'R2:Delta Rubber',ruleId:'R2',title:'Did we pay a small supplier late?',party:'Delta Rubber',amount:80000000},
  {flagKey:'R3:Meridian Co-operative Bank Term Loan',ruleId:'R3',title:'How much of this loan is due this year?',party:'Meridian Co-operative Bank',amount:9600000000},
];
const r3={
  flag:{flagKey:'R3:Meridian Co-operative Bank Term Loan',party:'Meridian Co-operative Bank',ledger:'Meridian Co-operative Bank Term Loan',amount:9600000000,band:'flagged'},
  context:'The books show a term loan from Meridian Co-operative Bank with a closing balance of ₹9,60,00,000.',
  question:{question:'Are the sanction letter and the repayment schedule on file?',buttons:b([['both','Both on file'],['neither','Neither']])},
  evidence:[{id:'R3-SANCTION',label:'Sanction letter'}],
};
const r3Snapshot={kind:'split',split:{balance:9600000000,totalInstalments:60,paid:12,remaining:48,instalment:200000000,due12:2400000000},
  entry:{debit:'Meridian Co-operative Bank Term Loan',credit:'Current maturities of long-term borrowings',amount:2400000000},
  currentBefore:{assets:37000000000,liabilities:30100000000,ratio:1.2292},currentAfter:{assets:37000000000,liabilities:32500000000,ratio:1.1385},covenantMin:1.2,covenantBefore:'within',covenantAfter:'breach',notes:['Controller to confirm.']};
const company={
  profitAndLoss:{revenue:150000000000,materials:95500000000,directCosts:25115500000,otherExpenses:20534500000,otherIncome:150000000,pbt:9000000000},
  balanceSheet:{fixedAssets:18500000000,inventory:9000000000,receivables:27000000000,cashAndBank:600000000,equity:15200000000,borrowings:21300000000,tradePayables:18600000000},
  ratios:{profitMargin:0.06,debtEquity:1.4013,debtEquityCap:1.5,currentRatio:1.2292,currentFloor:1.2,receivableDays:65.7,inventoryDays:34.42,payableDays:71.09},
  audit:{materiality:450000000,flagLine:225000000},
};
async function layout(page:Page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  for(const target of await page.locator('button,a[href],input').all()){const box=await target.boundingBox();expect(box).not.toBeNull();expect(box!.height).toBeGreaterThanOrEqual(43.5);}
}
for(const width of [390,1440]) {
  test(`story mode at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    let session:string|null=null,answered=false,decided=false,rest=false;
    const writes:Record<string,Record<string,unknown>>={};
    await page.route('https://m0-browser-test.convex.cloud/**',async route=>{
      const body=JSON.parse(route.request().postData()??'{}') as {path?:string;args?:unknown};
      const path=body.path??'',args=((Array.isArray(body.args)?body.args[0]:body.args)??{}) as Record<string,unknown>;
      let value:unknown=null;
      if(path==='visitor:start') {session=args.sessionId as string;value={ok:true};}
      else if(path==='visitor:status') value={exists:session!==null&&args.sessionId===session,expiresAt:null,expired:false};
      else if(path==='story:board') value={
        session:{exists:session!==null&&args.sessionId===session,expired:false},
        cases:cards.map(c=>args.sessionId!==session?{...c,status:'open',decidedAt:null,line:null}
          :c.ruleId==='R1'?{...c,status:decided?'approved':answered?'answered':'open',decidedAt:decided?1:null,line:decided?{entry:'Move ₹2,50,00,000 from trade payables to short-term borrowings.',effect:'Debt-equity 1.40 → 1.57 against the 1.50 limit: breaks'}:null}
          :c.ruleId==='R2'&&rest?{...c,status:'sent_back',decidedAt:2,line:null}
          :c.ruleId==='R3'&&rest?{...c,status:'approved',decidedAt:3,line:{entry:'Move ₹2,40,00,000 due within 12 months to current liabilities.',effect:'Current ratio 1.23 → 1.14 against the 1.20 floor: breaks'}}
          :{...c,status:'open',decidedAt:null,line:null}),
        meters:{debtEquity:{booked:1.4013,now:decided&&args.sessionId===session?1.5658:1.4013,limit:1.5},currentRatio:{booked:1.2292,now:rest&&args.sessionId===session?1.1385:1.2292,floor:1.2}},
      };
      else if(path==='answers:detail') value={...r1,answer:answered?{flagKey:'R1:Rajesh Mehta',nature:'loan',counterparty:'director',term:'within_12_months',declaration:'no',answeredAt:7}:null,snapshot:answered?r1Snapshot:null,decision:decided?{decision:'approved',decidedAt:1}:null};
      else if(path==='answers:record') {writes.record=args;answered=true;value={ok:true};}
      else if(path==='answers:decide') {writes.decide=args;decided=true;value={ok:true};}
      else if(path==='msme:detail') value={...r2,decision:rest?{decision:'sent_back',decidedAt:2}:null};
      else if(path==='termloan:detail') value={...r3,answer:rest?{documents:'both',answeredAt:3}:null,snapshot:rest?r3Snapshot:null,decision:rest?{decision:'approved',decidedAt:3}:null};
      else if(path==='story:company') value=company;
      else if(path==='rbi:latest') value=rate;
      else if(path==='rbi:check') {writes.check=args;value={status:'cached',checksLeft:2,rate};}
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'success',value,logLines:[]})});
    });
    const shot=(name:string)=>page.screenshot({path:`artifacts/m3/screens/${name}-${width}.png`,fullPage:true});

    await page.goto('/#/story');
    await expect(page.getByRole('heading',{name:'Your first week as controller.'})).toBeVisible();
    await expect(page.getByText("Northfield's books close for audit soon.")).toBeVisible();
    await expect(page.getByText('Whose money is this?')).toBeVisible();
    await expect(page.getByText('₹2.5 crore, Rajesh Mehta')).toBeVisible();
    await expect(page.getByRole('link',{name:/Whose money is this/})).toHaveCount(0);
    await expect(page.getByRole('meter',{name:'Debt-equity'})).toContainText('1.40');
    await expect(page.getByText('Synthetic company and data. Nothing here is advice.')).toBeVisible();
    const start=page.getByRole('button',{name:'Start the clock'});
    await expect(start).toBeDisabled();
    await page.getByLabel('Pick a sign-off code.').fill('abc');
    await expect(start).toBeDisabled();
    await page.getByLabel('Pick a sign-off code.').fill('teal-otter');
    await expect(start).toBeEnabled();
    await layout(page);
    await shot('briefing');
    await start.click();

    await expect(page.getByRole('link',{name:/Whose money is this/})).toBeVisible();
    await expect(page.locator('.story-card')).toHaveCount(3);
    await expect(page.getByRole('meter',{name:'Debt-equity'})).toContainText('1.40');
    await expect(page.getByRole('meter',{name:'Current ratio'})).toContainText('1.23');
    expect(session).toMatch(/^[0-9a-f-]{36}$/);
    expect(await page.evaluate(()=>sessionStorage.getItem('nf-story-session'))).toBe(session);
    expect(JSON.stringify(await page.evaluate(()=>({...sessionStorage})))).not.toContain('teal-otter');
    await page.waitForTimeout(400);
    await layout(page);
    await shot('board');

    await page.getByRole('link',{name:/Whose money is this/}).click();
    await expect(page.getByRole('heading',{name:'Rajesh Mehta'})).toBeVisible();
    await expect(page.getByRole('link',{name:'← Case board'})).toHaveAttribute('href','#/story');
    await page.getByRole('button',{name:'Loan',exact:true}).click();
    await page.getByRole('button',{name:'Director',exact:true}).click();
    await page.getByRole('button',{name:'Within 12 months'}).click();
    await page.getByRole('button',{name:'No',exact:true}).click();
    await page.getByLabel('Sign-off code').fill('teal-otter');
    await page.getByRole('button',{name:'Save answer'}).click();
    await expect(page.getByText('Answer saved.')).toBeVisible();
    await page.getByRole('button',{name:'Approve',exact:true}).click();
    await expect(page.locator('.decision')).toHaveText('Approved');
    expect(writes.record).toMatchObject({sessionId:session,flagKey:'R1:Rajesh Mehta',passcode:'teal-otter',nature:'loan',declaration:'no'});
    expect(writes.decide).toMatchObject({sessionId:session,flagKey:'R1:Rajesh Mehta',decision:'approved',answeredAt:7});
    await layout(page);
    await shot('case');
    const next=page.getByRole('link',{name:'Next case: Did we pay a small supplier late? →'});
    await expect(next).toHaveAttribute('href','#/story/case/R2%3ADelta%20Rubber');
    await page.waitForTimeout(300);
    await layout(page);
    await shot('case-next');
    await next.click();
    await expect(page.getByRole('heading',{name:'Delta Rubber'})).toBeVisible();
    expect(await page.evaluate(()=>window.scrollY)).toBe(0);
    await expect(page.getByRole('link',{name:/^Next case|Back to the case board/})).toHaveCount(0);

    await page.getByRole('link',{name:'← Case board'}).click();
    await expect(page.getByRole('link',{name:/Whose money is this/}).locator('.chip')).toHaveText('Approved');
    await expect(page.getByRole('meter',{name:'Debt-equity'})).toHaveAttribute('aria-valuetext','1.57, above the 1.50 limit');
    await expect(page.getByRole('meter',{name:'Debt-equity'})).toContainText('1.57');

    await page.getByRole('link',{name:/Did we pay a small supplier late/}).click();
    await expect(page.getByRole('heading',{name:'Delta Rubber'})).toBeVisible();
    await expect(page.getByText('Last checked 21 Oct 2026, 3:58 pm IST · Bank Rate 5.75% · Next scheduled change: 4 December 2026')).toBeVisible();
    await page.getByRole('button',{name:"Check today's RBI rate"}).click();
    await expect(page.getByText('Already up to date (checked 3:58 pm)')).toBeVisible();
    expect(writes.check).toEqual({sessionId:session});
    await layout(page);

    await page.getByRole('link',{name:'← Case board'}).click();
    await page.getByRole('link',{name:'Go to the debrief'}).click();
    await expect(page.getByRole('heading',{name:'Audit-ready?'})).toBeVisible();
    const rows=page.locator('.debrief-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Approved');
    await expect(rows.nth(0)).toContainText('Debt-equity 1.40 → 1.57 against the 1.50 limit: breaks');
    await expect(rows.nth(1)).toContainText('Not decided yet');
    await expect(rows.nth(2)).toContainText('Not decided yet');
    await expect(page.getByText('The covenant breaks because the books are now right, not because the controller failed.')).toBeVisible();
    await expect(page.getByRole('link',{name:'Read how it was built'})).toHaveAttribute('href','https://hq.swapnilsoren.com/builds/audit-readiness-check');
    await expect(page.getByText('All three cases decided.')).toHaveCount(0);
    await page.waitForTimeout(400);
    await layout(page);
    await shot('debrief');

    rest=true;
    await page.getByRole('link',{name:'← Case board'}).click();
    await expect(page.getByText('All three cases decided.')).toBeVisible();
    const toDebrief=page.getByRole('link',{name:'See your debrief →'});
    await expect(toDebrief).toHaveAttribute('href','#/story/debrief');
    await expect(page.getByRole('link',{name:/Did we pay a small supplier late/}).locator('.chip')).toHaveText('Sent back');
    await page.waitForTimeout(400);
    await layout(page);
    await shot('board-done');

    await page.getByRole('link',{name:/How much of this loan/}).click();
    await expect(page.getByRole('heading',{name:'Meridian Co-operative Bank'})).toBeVisible();
    const back=page.getByRole('link',{name:'Back to the case board →'});
    await expect(back).toHaveAttribute('href','#/story');
    await layout(page);
    await back.click();
    await expect(toDebrief).toBeVisible();

    await page.getByRole('link',{name:"See the company's accounts"}).click();
    await expect(page.getByRole('heading',{name:"Northfield's books, FY2025-26"})).toBeVisible();
    await expect(page.getByRole('link',{name:'← Case board'})).toHaveAttribute('href','#/story');
    await page.getByRole('link',{name:'← Case board'}).click();

    await toDebrief.click();
    await expect(page.getByRole('heading',{name:'Case closed.'})).toBeVisible();
    await expect(page.getByText("That's your first week. Fixed rules worked out every number from the books; you made every call.")).toBeVisible();
    await expect(page.getByRole('link',{name:'Read how it was built'})).toHaveAttribute('href','https://hq.swapnilsoren.com/builds/audit-readiness-check');
    await expect(page.getByRole('link',{name:'See the code'})).toHaveAttribute('href','https://github.com/swapnilsagarsoren-code/audit-readiness-check');
    await expect(page.getByRole('link',{name:'Read the write-up'})).toHaveCount(0);
    await page.waitForTimeout(400);
    await layout(page);
    await shot('debrief-end');

    await page.getByRole('button',{name:'Play again'}).click();
    await expect(page.getByRole('heading',{name:'Your first week as controller.'})).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('nf-story-session'))).toBeNull();
    expect(new URL(page.url()).hash).toBe('#/story');
    expect(await page.evaluate(()=>window.scrollY)).toBe(0);
    await expect(page.getByLabel('Pick a sign-off code.')).toHaveValue('');
    await expect(page.getByRole('button',{name:'Start the clock'})).toBeDisabled();
    await expect(page.getByRole('meter',{name:'Debt-equity'})).toContainText('1.40');

    await page.getByRole('link',{name:"See the company's accounts"}).click();
    await expect(page.getByRole('heading',{name:"Northfield's books, FY2025-26"})).toBeVisible();
    await expect(page.getByRole('link',{name:'← Back to the briefing'})).toHaveAttribute('href','#/story');
    await expect(page.locator('table')).toHaveCount(4);
    for(const name of ['Profit and loss','Balance sheet','Ratios','Audit lens']) await expect(page.getByRole('table',{name})).toBeVisible();
    const row=(label:string)=>page.getByRole('row').filter({has:page.getByRole('rowheader',{name:new RegExp(`^${label}`)})});
    for(const [label,value] of [['Revenue','₹150.0 crore'],['Direct costs','₹25.1 crore'],['Other income','₹15.0 lakh'],['Profit before tax','₹9.0 crore'],['Cash and bank','₹60.0 lakh'],['Borrowings','₹21.3 crore'],['Profit margin','6.0%'],['Debt-equity','1.40'],['Current ratio','1.23'],['Receivable days','66 days'],['Inventory days','34 days'],['Payable days','71 days'],['Materiality','₹45.0 lakh'],['Flag line','₹22.5 lakh']]) await expect(row(label).getByRole('cell')).toHaveText(value);
    await expect(page.getByText('Year-end trial balance as booked, before your three decisions. Synthetic company.')).toBeVisible();
    await expect(page.getByText('Synthetic company and data. Nothing here is advice.')).toBeVisible();
    expect(await page.locator('.company td').evaluateAll(cells=>cells.every(c=>getComputedStyle(c).fontVariantNumeric.includes('tabular-nums')))).toBe(true);
    await expect(page.locator('svg,canvas')).toHaveCount(0);
    await page.waitForTimeout(400);
    await layout(page);
    await shot('company');
  });
}
