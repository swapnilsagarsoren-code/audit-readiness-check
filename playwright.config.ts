import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', retries:0, workers:1, reporter:'list',
  use:{channel:'chrome',baseURL:'http://127.0.0.1:4173',screenshot:'off',video:'off',trace:'off'},
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:false,env:{VITE_CONVEX_URL:'https://m0-browser-test.convex.cloud'}},
});
