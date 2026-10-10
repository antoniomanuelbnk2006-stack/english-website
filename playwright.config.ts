import { defineConfig, devices } from '@playwright/test';

// Puertos y carpeta de compilación propios: los tests no chocan con la demo (`pnpm demo`,
// puertos 3000 y 54399, carpeta .next), que puede seguir abierta mientras corren.
const APP_PORT = 3100;
const EMULATOR_PORT = 54398;
const DIST_DIR = '.next-e2e';

// Los e2e corren contra un emulador de Supabase (tests/support/supabase-emulator.ts):
// un Postgres real en memoria con las migraciones del proyecto, sin Docker ni cuentas.
export const E2E = {
  email: 'owner@example.invalid',
  otp: '123456',
  /** Código con el que el emulador da por bueno el enlace del correo. */
  authCode: 'e2e-auth-code-0001',
  /** Código fijo de acceso que acepta el emulador (ADR-0020). */
  fixedCode: '654321',
  emulatorUrl: `http://127.0.0.1:${EMULATOR_PORT}`,
};

const env = {
  NEXT_PUBLIC_SUPABASE_URL: E2E.emulatorUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'e2e-publishable-key',
  // El audio de prueba (tonos) va en su propia carpeta para no pisar el real.
  NEXT_PUBLIC_AUDIO_BASE_URL: '/dev-audio/e2e',
  ALLOWED_EMAIL: E2E.email,
  // Activa el acceso con código fijo; el emulador deriva la misma contraseña con este secreto.
  LOGIN_CODE_PEPPER: 'secreto-solo-para-los-tests-e2e-0123456789',
  EMULATOR_PORT: String(EMULATOR_PORT),
  // Contenido de prueba: el real más una lección de escucha con audio generado para los tests.
  CONTENT_DIR: '.e2e/content',
  NEXT_DIST_DIR: DIST_DIR,
  // La corrección de writing habla con un doble de la API de Claude que sirve el emulador:
  // los tests nunca llaman a la API real ni gastan dinero.
  ANTHROPIC_API_KEY: 'e2e-key',
  ANTHROPIC_BASE_URL: `${E2E.emulatorUrl}/anthropic`,
  // El buscador de palabras habla con un doble de Wiktionary que sirve el emulador.
  DICTIONARY_API_URL: `${E2E.emulatorUrl}/wiktionary`,
  // Fijos aquí para que un .env.local con otros valores no cambie lo que prueban los tests.
  AI_WRITING_MODEL: 'claude-sonnet-5-5',
  AI_DAILY_LIMIT: '3',
  AI_MONTHLY_BUDGET_USD: '5',
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
    // Micrófono de mentira (un tono) y permiso concedido: el simulador de Speaking graba de
    // verdad sin pedir nada ni depender del equipo donde corren los tests.
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
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
