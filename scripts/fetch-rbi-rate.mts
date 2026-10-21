// Fetches the Bank Rate from rbi.org.in and stores it on the dev deployment with today's date (IST) and the source URL.
// Run by Swapnil: npx tsx scripts/fetch-rbi-rate.mts. Dev only: it refuses any deployment other than your-dev-deployment.
import { spawnSync } from 'node:child_process';
import { parseBankRate, istDate } from '../shared/rbi-rate.ts';

const URL_RBI = 'https://www.rbi.org.in/';
const DEPLOYMENT = 'your-dev-deployment';
const response = await fetch(URL_RBI, { redirect: 'manual', signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'Mozilla/5.0' } });
if (response.status !== 200) throw new Error(`RBI site answered ${response.status}; nothing stored.`);
const rate = parseBankRate(await response.text());
const date = istDate(Date.now());
console.log(`RBI site lists a Bank Rate of ${rate}% on ${date}. Storing on ${DEPLOYMENT}.`);
const run = spawnSync('npx', ['convex', 'run', '--deployment', DEPLOYMENT, 'rates:save', JSON.stringify({ value: rate, date, sourceUrl: URL_RBI })], { stdio: 'inherit' });
process.exit(run.status ?? 1);
