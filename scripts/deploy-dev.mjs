import { spawnSync } from 'node:child_process';

// The hosting tool's one-shot deploy targets production, so dev pushes the backend and uploads the story build separately.
const env = { ...process.env, CONVEX_DEPLOYMENT: 'dev:your-dev-deployment', VITE_STORY: '1', NO_COLOR: '1' };
for (const args of [['convex', 'dev', '--once'], ['@convex-dev/static-hosting', 'upload', '--build']]) {
  const result = spawnSync('npx', args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Dev URL: https://your-dev-deployment.convex.site');
