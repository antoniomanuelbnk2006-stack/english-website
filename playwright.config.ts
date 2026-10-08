import { defineConfig, devices } from '@playwright/test';

const APP_PORT = 3100;
const EMULATOR_PORT = 54399;

// Los e2e corren contra un emulador de Supabase (tests/support/supabase-emulator.ts):
// un Postgres real en memoria con las migraciones del proyecto, sin Docker ni cuentas.
export const E2E = {
  email: 'owner@example.invalid',
  otp: '123456',
  emulatorUrl: `http://127.0.0.1:${EMULATOR_PORT}`,
};

const env = {
  NEXT_PUBLIC_SUPABASE_URL: E2E.emulatorUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'e2e-publishable-key',
  // El audio de prueba (tonos) va en su propia carpeta para no pisar el real.
  NEXT_PUBLIC_AUDIO_BASE_URL: '/dev-audio/e2e',
  ALLOWED_EMAIL: E2E.email,
  EMULATOR_PORT: String(EMULATOR_PORT),
  // Contenido de prueba: el real más una lección de escucha con audio generado para los tests.
  CONTENT_DIR: '.e2e/content',
};

export default defineConfig({
  testDir: './tests/e2e',
  // Un solo usuario y una sola base de datos: los tests no se ejecutan en paralelo.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    // Sin transiciones: axe mide los colores finales y no un fotograma a medio cambiar de tema.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx tests/support/supabase-emulator.ts',
      url: `${E2E.emulatorUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env,
    },
    {
      command: `pnpm exec tsx tests/support/build-fixture-content.ts && pnpm build && pnpm start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env,
    },
  ],
});
