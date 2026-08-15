import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PORT = 5173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @rautfall/api exec tsx src/server.ts',
      cwd: WORKSPACE_ROOT,
      url: 'http://127.0.0.1:3000/api/health',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: process.env.DATABASE_URL || 'postgres://rautfall:rautfall@127.0.0.1:5432/rautfall',
        PORT: '3000',
        HOST: '127.0.0.1',
        CORS_ORIGIN: 'http://localhost:5173,http://127.0.0.1:5173',
      },
    },
    {
      command: `pnpm --filter @rautfall/web exec vite --host ${HOST} --port ${PORT} --strictPort`,
      cwd: WORKSPACE_ROOT,
      url: BASE_URL,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_BASE_URL: 'http://127.0.0.1:3000',
      },
    },
  ],
});