import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` lanza fuera del bundler de Next; en los tests es un módulo vacío.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    // Lógica pura por defecto; los tests de componentes piden jsdom con `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/db/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Los tests de base de datos arrancan un Postgres en memoria por archivo; con muchos
    // archivos en paralelo el arranque pasa de los 10 s por defecto aunque nada falle.
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/features/*/lib/**', 'src/lib/**'],
      exclude: ['**/*.test.{ts,tsx}', 'src/lib/supabase/**', 'src/lib/i18n/{es,en}.ts'],
    },
  },
});
