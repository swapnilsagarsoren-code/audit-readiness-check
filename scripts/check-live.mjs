// Read-only live check: node scripts/check-live.mjs https://<deployment>.convex.site
// Loads the page and its script, then asks the server for a new visitor's board and the stored RBI rate. Writes nothing.
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

const site = process.argv[2];
if (!/^https:\/\/[a-z0-9-]+\.convex\.site$/.test(site ?? '')) { console.error('Usage: node scripts/check-live.mjs https://<deployment>.convex.site'); process.exit(2); }
const fails = [];
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) fails.push(what); };

const page = await fetch(site);
const html = await page.text();
check(page.status === 200, `page answers 200 (${page.status})`);
const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
check(!!script, 'page links its script');
if (script) {
  const js = await (await fetch(site + script)).text();
  check(js.includes('Your first week as controller.'), 'the build is the story mode');
  check(js.includes(site.replace('.convex.site', '.convex.cloud')), 'the build talks to this deployment');
}
const client = new ConvexHttpClient(site.replace('.convex.site', '.convex.cloud'));
const board = await client.query(makeFunctionReference('story:board'), { sessionId: crypto.randomUUID() });
check(board.session.exists === false, 'a new visitor has no session yet');
check(board.cases.length === 3 && board.cases.every(c => c.amount !== null && c.status === 'open'), 'three cases with amounts, all open');
check(board.meters.debtEquity.now.toFixed(2) === '1.40' && board.meters.currentRatio.now.toFixed(2) === '1.23', `meters at 1.40 and 1.23 (${board.meters.debtEquity.now.toFixed(2)}, ${board.meters.currentRatio.now.toFixed(2)})`);
const company = await client.query(makeFunctionReference('story:company'), {});
check(Math.round(company.profitAndLoss.revenue / 1e9) === 150 && company.ratios.debtEquity.toFixed(2) === '1.40', `company dashboard: revenue ₹${(company.profitAndLoss.revenue / 1e9).toFixed(1)} cr, debt-equity ${company.ratios.debtEquity.toFixed(2)}`);
const rate = await client.query(makeFunctionReference('rbi:latest'), {});
console.log(`INFO stored Bank Rate: ${rate ? `${rate.value}% from ${rate.date}` : 'none yet (the first visitor press fetches it)'}`);
console.log(fails.length ? `FAILED ${fails.length}` : 'ALL PASS');
process.exit(fails.length ? 1 : 0);
