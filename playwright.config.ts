import { defineConfig, devices } from '@playwright/test';
import net from 'node:net';

/**
 * E2E uses isolated ports so a local `uvicorn` on 8000 or Vite on 5173 cannot
 * block the harness. Product defaults stay 8000 / 5173.
 *
 * Override with PLAYWRIGHT_API_PORT / PLAYWRIGHT_WEB_PORT if needed.
 * Set PLAYWRIGHT_REUSE_BACKEND=1 only when 8000 is this repo's healthy e2e API.
 */

function canConnect(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function isHealthy(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitHealthy(url: string, attempts = 15): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await isHealthy(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

async function resolvePort(start: number, healthPath: string): Promise<{ port: number; reuse: boolean }> {
  for (let port = start; port < start + 25; port++) {
    const url = `http://127.0.0.1:${port}${healthPath}`;
    if (await canConnect(port)) {
      if (await waitHealthy(url)) return { port, reuse: true };
      continue;
    }
    return { port, reuse: false };
  }
  throw new Error(`No free test port near ${start}. Set PLAYWRIGHT_API_PORT / PLAYWRIGHT_WEB_PORT.`);
}

const api = await resolvePort(Number(process.env.PLAYWRIGHT_API_PORT || 8010), '/health');
const web = await resolvePort(Number(process.env.PLAYWRIGHT_WEB_PORT || 5174), '/');
const apiOrigin = `http://127.0.0.1:${api.port}`;
const webOrigin = `http://127.0.0.1:${web.port}`;

process.env.PLAYWRIGHT_API_ORIGIN = apiOrigin;
process.env.PLAYWRIGHT_WEB_ORIGIN = webOrigin;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results/playwright',
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ar-SA',
  },
  projects: [
    { name: 'chromium', grepInvert: /@reduced-motion/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-reduced-motion',
      grep: /@reduced-motion/,
      use: {
        ...devices['Desktop Chrome'],
        reducedMotion: 'reduce',
      },
    },
  ],
  webServer: [
    {
      command: 'python e2e_seed.py && python -m uvicorn app.main:app --host 127.0.0.1 --port ' + String(api.port),
      cwd: './backend',
      url: `${apiOrigin}/health`,
      reuseExistingServer: api.reuse,
      timeout: 180_000,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        DATABASE_URL: 'sqlite:///./e2e.db',
        TESTING: 'True',
        AUTO_CREATE_TABLES: 'false',
        CORS_ORIGINS: webOrigin,
        TRUSTED_HOSTS: '127.0.0.1,localhost',
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${web.port}`,
      url: webOrigin,
      reuseExistingServer: web.reuse,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `${apiOrigin}/api`,
      },
    },
  ],
});
