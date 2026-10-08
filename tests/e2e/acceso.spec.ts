import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';

// Flujos de acceso que no necesitan una sesión real (ni un Supabase detrás).

test.describe('sin sesión', () => {
  for (const path of ['/', '/hoy', '/leer', '/escuchar', '/repasar', '/ajustes']) {
    test(`${path} redirige al acceso`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Entra en Señal' })).toBeVisible();
    });
  }

  test('las rutas de API responden 401 en vez de redirigir', async ({ request }) => {
    const response = await request.get('/api/ai/writing-feedback', { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  test('la respuesta lleva una CSP con nonce y sin unsafe-inline en scripts', async ({
    request,
  }) => {
    const response = await request.get('/login');
    const csp = response.headers()['content-security-policy'] ?? '';
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(csp).toContain(`frame-ancestors 'none'`);
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });
});

test.describe('pantalla de acceso', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('es accesible y no deja errores en consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.reload({ waitUntil: 'networkidle' });
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });

  test('avisa si el email no es válido', async ({ page }) => {
    await page.getByLabel('Email').fill('no-es-un-email');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Ese email no parece válido.');
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  test('un email sin acceso recibe la misma respuesta y no puede entrar', async ({ page }) => {
    await page.getByLabel('Email').fill('otra@persona.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();

    // No se revela si el email tiene acceso: se pasa igualmente al paso del código.
    await expect(page.getByRole('status')).toContainText('Si otra@persona.com tiene acceso');
    await expectAccessible(page);

    await page.getByLabel('Código de 6 dígitos').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'El código no es correcto o ha caducado. Pide uno nuevo.',
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('el código admite pegar con espacios y solo conserva 6 dígitos', async ({ page }) => {
    await page.getByLabel('Email').fill('otra@persona.com');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    const code = page.getByLabel('Código de 6 dígitos');
    await code.fill('123 456');
    await expect(code).toHaveValue('123456');
    await code.fill('12a3456789');
    await expect(code).toHaveValue('123456');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  test('se puede completar solo con teclado y volver a cambiar el email', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeFocused();
    await page.keyboard.type('otra@persona.com');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Código de 6 dígitos')).toBeFocused();
    await page.getByRole('button', { name: 'Usar otro email' }).click();
    await expect(page.getByLabel('Email')).toHaveValue('otra@persona.com');
  });
});
