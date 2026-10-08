import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// Variables de prueba: no apuntan a ningún Supabase real. Los flujos con sesión
// (tests/e2e/*.auth.spec.ts) necesitan uno y se saltan si falta E2E_SUPABASE.
const testEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'e2e-placeholder',
  NEXT_PUBLIC_AUDIO_BASE_URL: process.env.NEXT_PUBLIC_AUDIO_BASE_URL ?? '/dev-audio',
  ALLOWED_EMAIL: process.env.ALLOWED_EMAIL ?? 'owner@example.invalid',
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: testEnv,
  },
});
