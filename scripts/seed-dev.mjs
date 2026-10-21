import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const APPROVED_DEV_DEPLOYMENT = 'your-dev-deployment';
const root = fileURLToPath(new URL('../', import.meta.url));
const unsafeSelectors = ['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY'];

/** Read only the deployment selector; never include file contents in errors. */
export function parseDevDeployment(contents) {
  const assignments = contents.split(/\r?\n/).filter(line =>
    /^\s*(?:export\s+)?CONVEX_DEPLOYMENT\s*=/.test(line));
  if (assignments.length !== 1) {
    throw new Error('Seeding refused: .env.local must contain exactly one CONVEX_DEPLOYMENT assignment.');
  }
  const match = assignments[0].match(/^\s*(?:export\s+)?CONVEX_DEPLOYMENT\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s#'"`]+))\s*(?:#.*)?$/);
  const value = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
  if (!value.startsWith('dev:')) {
    throw new Error('Seeding refused: CONVEX_DEPLOYMENT must select dev.');
  }
  const name = value.slice(4);
  if (!/^[a-z][a-z0-9-]*$/.test(name) || ['prod', 'dev', 'local', 'anonymous'].includes(name) || /^(?:local|anonymous)-/.test(name)) {
    throw new Error('Seeding refused: an explicit cloud dev deployment name is required.');
  }
  return name;
}

export function assertApprovedDev(name) {
  if (name !== APPROVED_DEV_DEPLOYMENT) {
    throw new Error('Seeding refused: deployment does not match the approved cloud dev project.');
  }
}

export function assertNoAlternateSelectors(contents, env) {
  for (const key of unsafeSelectors) {
    if (env[key] || new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`, 'm').test(contents)) {
      throw new Error('Seeding refused: an alternate Convex credential or self-hosted selector is present.');
    }
  }
}

/** The injected process runner is only for offline orchestration tests. */
export function runSeedSteps(deployment, { run = spawnSync, env = process.env, log = console.log, error = console.error } = {}) {
  assertApprovedDev(deployment);
  assertNoAlternateSelectors('', env);
  const childEnv = { ...env, CONVEX_DEPLOYMENT: `dev:${deployment}`, CONVEX_ALLOW_ANONYMOUS: 'false' };
  const steps = [
    { name: 'set seed guard', command: 'npx', args: ['--no-install', 'convex', 'env', 'set', 'SEED_ALLOWED', 'dev-only', '--deployment', deployment] },
    { name: 'push dev functions', command: 'npx', args: ['--no-install', 'convex', 'dev', '--once'] },
    { name: 'seed data chunks', command: process.execPath, args: ['--import', 'tsx', 'scripts/seed-data.ts', '--deployment', deployment] },
    { name: 'read row counts', command: 'npx', args: ['--no-install', 'convex', 'run', '--deployment', deployment, 'seed:counts', '{}'], capture: true },
  ];
  for (const step of steps) {
    log(`SEED_STEP ${step.name}`);
    const result = run(step.command, step.args, {
      cwd: root, env: childEnv, encoding: 'utf8',
      stdio: ['ignore', step.capture ? 'pipe' : 'inherit', 'inherit'],
    });
    if (result.error || result.status !== 0) {
      error(`Seeding stopped: ${step.name} did not complete.`);
      // Preserve an actual failing exit code; signals/launch errors have no exit code.
      return result.status !== null && result.status !== 0 ? result.status : 1;
    }
    if (step.capture) {
      let counts;
      try { counts = JSON.parse(result.stdout); } catch {
        error('Seeding stopped: row-count response was not valid JSON.');
        return 1;
      }
      if (!counts || !['ledgers', 'entries', 'suppliers'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) {
        error('Seeding stopped: row-count response was incomplete or invalid.');
        return 1;
      }
      log(`SEED_RESULT ledgers=${counts.ledgers} entries=${counts.entries} suppliers=${counts.suppliers}`);
    }
  }
  return 0;
}

export function main() {
  try {
    let contents;
    try { contents = readFileSync(resolve(root, '.env.local'), 'utf8'); } catch {
      console.error('Seeding refused: .env.local could not be read.');
      return 1;
    }
    const deployment = parseDevDeployment(contents);
    assertApprovedDev(deployment);
    assertNoAlternateSelectors(contents, process.env);
    // Convex can also read .env; fail closed if it contains another selector.
    let defaults = '';
    try { defaults = readFileSync(resolve(root, '.env'), 'utf8'); } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Seeding refused: default environment configuration could not be checked.');
        return 1;
      }
    }
    assertNoAlternateSelectors(defaults, {});
    return runSeedSteps(deployment);
  } catch (err) {
    // Only our fixed refusal messages are safe to print; never echo external errors.
    console.error(err instanceof Error && err.message.startsWith('Seeding refused:') ? err.message : 'Seeding refused: configuration validation failed.');
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
