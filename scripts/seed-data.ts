import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readCsv } from '../shared/csv.ts';
import { decodeEntries,decodeLedgers,decodeSuppliers,validateEntry,validateLedger,validateSupplier } from '../shared/seed-records.ts';
export async function loadSeedData(root:string) {
  const read=(file:string)=>readFile(resolve(root,'data/synthetic',file),'utf8');
  const company=JSON.parse(await read('company.json'));
  const ledgers=decodeLedgers(readCsv(await read('ledgers.csv'))), entries=decodeEntries(readCsv(await read('daybook.csv'))), suppliers=decodeSuppliers(readCsv(await read('suppliers.csv')));
  ledgers.forEach(validateLedger); entries.forEach(validateEntry); suppliers.forEach(validateSupplier);
  return {company,ledgers,entries,suppliers};
}
export async function seedChunks(deployment:string) {
  if(!/^[a-z][a-z0-9-]*$/.test(deployment)||deployment==='prod'||deployment.startsWith('local-')||deployment.startsWith('anonymous-')||process.env.CONVEX_DEPLOYMENT!==`dev:${deployment}`) throw new Error('Seeding refused: an explicit cloud dev deployment is required.');
  const data=await loadSeedData('.');
  for(const [kind,rows] of [['ledger',data.ledgers],['supplier',data.suppliers],['entry',data.entries],['company',[data.company]]] as const) {
    for(let i=0;i<rows.length;i+=100) {
      const result=spawnSync('npx',['--no-install','convex','run','--deployment',deployment,'seed:seedSynthetic',JSON.stringify({payload:{kind,rows:rows.slice(i,i+100)}})],{stdio:'inherit',env:{...process.env,CONVEX_ALLOW_ANONYMOUS:'false'}});
      if(result.error) { console.error('Seeding refused: could not start the Convex command.'); process.exit(1); }
      if(result.status!==0) process.exit(result.status??1);
    }
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try { if(process.argv[2]!=='--deployment'||!process.argv[3]) throw new Error('Seeding refused: deployment name is required.'); await seedChunks(process.argv[3]); }
  catch { console.error('Seeding refused: dev deployment or synthetic input validation failed.'); process.exitCode=1; }
}
