import { defineConfig, devices } from '@playwright/test';

const HOST = '127.0.0.1';
const WEB_PORT = 5180;
const BASE_URL = `http://${HOST}:${WEB_PORT}`;

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
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});