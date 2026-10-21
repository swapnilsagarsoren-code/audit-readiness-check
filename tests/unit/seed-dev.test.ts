import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_DEV_DEPLOYMENT, parseDevDeployment, assertApprovedDev, assertNoAlternateSelectors, runSeedSteps } from '../../scripts/seed-dev.mjs';

for (const [label, content] of [
  ['plain', 'CONVEX_DEPLOYMENT=dev:your-dev-deployment'],
  ['spaces and comments', '\n # CONVEX_DEPLOYMENT=prod:ignored\n\n CONVEX_DEPLOYMENT = dev:your-dev-deployment # cloud dev\n'],
  ['Windows line endings', '# comment\r\n\r\nCONVEX_DEPLOYMENT=dev:your-dev-deployment\r\n'],
  ['double quotes', 'CONVEX_DEPLOYMENT="dev:your-dev-deployment" # comment'],
  ['single quotes and export', "export CONVEX_DEPLOYMENT = 'dev:your-dev-deployment' # comment"],
  ['unrelated assignments', 'OTHER=synthetic-test-value\nCONVEX_DEPLOYMENT=dev:your-dev-deployment\nVITE_CONVEX_URL=synthetic-test-url'],
]) test(`dev selector parses ${label}`, () => {
  assert.equal(parseDevDeployment(content), APPROVED_DEV_DEPLOYMENT);
});

for (const [label, content] of [
  ['missing', ''], ['commented out', '# CONVEX_DEPLOYMENT=dev:your-dev-deployment'],
  ['empty', 'CONVEX_DEPLOYMENT='], ['empty quoted', 'CONVEX_DEPLOYMENT=""'],
  ['production prefix', 'CONVEX_DEPLOYMENT=prod:synthetic-name'],
  ['prod alias', 'CONVEX_DEPLOYMENT=dev:prod'], ['local prefix', 'CONVEX_DEPLOYMENT=local:synthetic-name'],
  ['local alias', 'CONVEX_DEPLOYMENT=dev:local'], ['local name', 'CONVEX_DEPLOYMENT=dev:local-example'],
  ['anonymous alias', 'CONVEX_DEPLOYMENT=dev:anonymous'], ['anonymous name', 'CONVEX_DEPLOYMENT=dev:anonymous-example'],
  ['dev alias', 'CONVEX_DEPLOYMENT=dev:dev'], ['missing name', 'CONVEX_DEPLOYMENT=dev:'],
  ['duplicate', 'CONVEX_DEPLOYMENT=dev:your-dev-deployment\nCONVEX_DEPLOYMENT=dev:your-dev-deployment'],
  ['trailing tokens', 'CONVEX_DEPLOYMENT=dev:your-dev-deployment unwanted'],
  ['unclosed quote', 'CONVEX_DEPLOYMENT="dev:your-dev-deployment'],
  ['shell expansion', 'CONVEX_DEPLOYMENT=dev:$(synthetic-command)'],
  ['reference syntax', 'CONVEX_DEPLOYMENT=dev:team/project'],
]) test(`dev selector refuses ${label} without echoing the input`, () => {
  assert.throws(() => parseDevDeployment(content), (error: Error) => {
    assert.match(error.message, /^Seeding refused:/);
    assert.ok(!error.message.includes(content) || content === '');
    return true;
  });
});

test('only the user-approved cloud name may start the pipeline', () => {
  assert.doesNotThrow(() => assertApprovedDev('your-dev-deployment'));
  assert.throws(() => assertApprovedDev('different-cloud-123'), /approved cloud/);
  let called = false;
  assert.throws(() => runSeedSteps('different-cloud-123', { run: (() => { called = true; }) as never }), /approved cloud/);
  assert.equal(called, false);
});

test('alternate credentials and self-hosted selectors refuse without exposing values', () => {
  for (const key of ['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY']) {
    for (const check of [() => assertNoAlternateSelectors(`${key}=synthetic-sensitive-value`, {}), () => assertNoAlternateSelectors('', { [key]: 'synthetic-sensitive-value' })]) {
      assert.throws(check, (error: Error) => { assert.match(error.message, /^Seeding refused:/); assert.ok(!error.message.includes('synthetic-sensitive-value')); return true; });
    }
  }
  assert.doesNotThrow(() => assertNoAlternateSelectors('# CONVEX_DEPLOY_KEY=comment-only', {}));
});

function runScenario(failAt = -1, countOutput = '{"ledgers":60,"entries":2500,"suppliers":13}') {
  const calls: { command: string; args: string[]; options: {env: Record<string,string>; stdio: string[]} }[] = [];
  const messages: string[] = [], errors: string[] = [];
  const fakeRun = (command: string, args: string[], options: {env: Record<string,string>; stdio: string[]}) => {
    const index = calls.length; calls.push({command, args, options});
    return {status: index === failAt ? 23 : 0, stdout: index === 3 ? countOutput : ''};
  };
  const code = runSeedSteps(APPROVED_DEV_DEPLOYMENT, {
    run: fakeRun as never, env: {PATH: '/synthetic-path', CONVEX_DEPLOYMENT: 'prod:must-be-overridden'},
    log: message => messages.push(message), error: message => errors.push(message),
  });
  return {calls,messages,errors,code};
}

test('offline runner contract pins every step to the exact dev and reads counts last', () => {
  const {calls,messages,errors,code} = runScenario();
  assert.equal(code,0); assert.equal(calls.length,4); assert.deepEqual(errors,[]);
  assert.deepEqual(calls[0].args,['--no-install','convex','env','set','SEED_ALLOWED','dev-only','--deployment','your-dev-deployment']);
  assert.deepEqual(calls[1].args,['--no-install','convex','dev','--once']);
  assert.deepEqual(calls[2].args,['--import','tsx','scripts/seed-data.ts','--deployment','your-dev-deployment']);
  assert.deepEqual(calls[3].args,['--no-install','convex','run','--deployment','your-dev-deployment','seed:counts','{}']);
  for (const {options} of calls) {
    assert.equal(options.env.CONVEX_DEPLOYMENT,'dev:your-dev-deployment'); assert.equal(options.env.CONVEX_ALLOW_ANONYMOUS,'false');
    assert.equal(options.stdio[0],'ignore');
  }
  assert.equal(calls[3].options.stdio[1],'pipe');
  assert.equal(messages.at(-1),'SEED_RESULT ledgers=60 entries=2500 suppliers=13');
});

for (const index of [0,1,2,3]) test(`offline runner preserves exit code and stops at failing step ${index+1}`, () => {
  const {calls,messages,errors,code} = runScenario(index);
  assert.equal(code,23); assert.equal(calls.length,index+1); assert.equal(errors.length,1);
  assert.ok(!messages.some(message => message.startsWith('SEED_RESULT')));
});

for (const output of ['not-json','null','{}','{"ledgers":-1,"entries":2500,"suppliers":13}','{"ledgers":60,"entries":2.5,"suppliers":13}']) test(`offline runner refuses invalid count response ${output}`, () => {
  const {code,messages} = runScenario(-1,output); assert.equal(code,1);
  assert.ok(!messages.some(message => message.startsWith('SEED_RESULT')));
});

test('offline runner handles process launch failure without exposing external error text', () => {
  const errors: string[] = [];
  const code = runSeedSteps(APPROVED_DEV_DEPLOYMENT, {env:{},run:(() => ({status:null,error:new Error('synthetic-sensitive-value')})) as never,log:()=>{},error:message=>errors.push(message)});
  assert.equal(code,1); assert.equal(errors.length,1); assert.ok(!errors[0].includes('synthetic-sensitive-value'));
});
