import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {SummaryPage,type ViewState} from '../../src/App.tsx';
async function files(root:string):Promise<string[]>{const result:string[]=[];for(const item of await readdir(root,{withFileTypes:true})){const path=join(root,item.name);if(item.isDirectory())result.push(...await files(path));else result.push(path);}return result;}
test('client, backend and seed scripts never reference the answer-key path',async()=>{
  const paths=[...await files('src'),...await files('convex'),...await files('shared'),...(await files('scripts')).filter(p=>/\/seed[^/]*\./.test(p))];
  for(const path of paths) assert.doesNotMatch(await readFile(path,'utf8'),/answer[-_]key/i,path);
});
test('client wording excludes banned expressions',async()=>{
  for(const path of await files('src')) assert.doesNotMatch(await readFile(path,'utf8'),/fraud|forensic|platform|continuously tracks|red flag|error found/i,path);
});
test('schema contains only the M0 tables plus the additive M1 and Gate A tables and CLI AI files are disabled',async()=>{
  const text=await readFile('convex/schema.ts','utf8');
  assert.deepEqual([...text.matchAll(/^  (\w+):defineTable/gm)].map(m=>m[1]).sort(),['aiUsage','answer','company','editAttempt','entry','flag','flagRun','ledger','msmeAnswer','msmeOutcome','outcome','period','question','rbiBankRate','rbiCheck','rule','supplier','termLoanAnswer','termLoanOutcome','usageCounter','visitorAttempt','visitorSession']);
  assert.equal(JSON.parse(await readFile('convex.json','utf8')).aiFiles.enabled,false);
});
test('seed mutation is internal and its handler starts with the deployment guard',async()=>{
  const text=await readFile('convex/seed.ts','utf8');assert.match(text,/seedSynthetic=internalMutation\(/);assert.match(text,/handler:async\(ctx,\{payload\}\)=>\{\s*assertSeedAllowed\(process.env\)/);
});
test('generator has no unseeded entropy or locale formatting',async()=>{
  const text=await readFile('scripts/generate-synthetic.ts','utf8');assert.doesNotMatch(text,/Math\.random|Date\.now|new Date\(\s*\)|toLocale|Intl\.|faker/);
});
for(const status of ['loading','error','empty'] as const)test(`${status} has dashes and no balance verdict`,()=>{
  const html=renderToStaticMarkup(createElement(SummaryPage,{state:{status},onRefresh:()=>{}}));
  assert.equal((html.match(/<dd>—<\/dd>/g)??[]).length,4);assert.ok(!html.includes('TB balanced:'));
  if(status==='error')assert.ok(html.includes('Couldn&#x27;t load data. Nothing here is final.'));
});
test('ready displays real counts and compares totals, including imbalance',()=>{
  for(const cr of [100,99]){
    const state:ViewState={status:'ready',data:{name:'Synthetic test company',fy:'FY2025-26',ledgerCount:60,voucherCount:1250,dr:100,cr}};
    const html=renderToStaticMarkup(createElement(SummaryPage,{state,onRefresh:()=>{}}));
    assert.ok(html.includes(`TB balanced: ${cr===100?'yes':'no'}`));assert.ok(html.includes('<dd>60</dd>'));assert.ok(html.includes('<dd>1250</dd>'));
  }
});
