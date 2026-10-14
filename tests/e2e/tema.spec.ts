import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Tema personalizado (ADR-0033): CSS propio, guardado en el perfil, que cambia toda la app. Se
// puede probar sin guardar, se quita con un botón y `?sin-tema` lo desactiva en esa página.

const SEPIA_CANVAS = 'rgb(243, 234, 216)';

const canvas = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function savedCss(request: Parameters<typeof queryDatabase>[0]): Promise<unknown> {
  const rows = await queryDatabase<{ css: unknown }>(
    request,
    "select settings->'custom_css' as css from public.profiles",
  );
  return rows[0]?.css ?? null;
}

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('se prueba, se guarda para toda la app y se quita', async ({ page, request }) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/ajustes');

  const panel = page.locator('#tema');
  await expect(panel.getByRole('heading', { name: 'Tema personalizado' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Quitar tema' })).toHaveCount(0);
  const original = await canvas(page);
  expect(original).not.toBe(SEPIA_CANVAS);

  // Un ejemplo rellena el CSS; probarlo cambia la página sin guardar nada.
  await panel.getByRole('button', { name: 'Sepia' }).click();
  await expect(panel.getByLabel('CSS del tema')).toHaveValue(/--canvas: #f3ead8;/);
  await panel.getByRole('button', { name: 'Probar sin guardar' }).click();
  await expect.poll(() => canvas(page)).toBe(SEPIA_CANVAS);
  await expect(panel.getByRole('status').last()).toHaveText(/Vista previa/);
  await expect(panel.getByRole('button', { name: 'Dejar de probar' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await savedCss(request)).toBeNull();
  await panel.getByRole('button', { name: 'Dejar de probar' }).click();
  await expect.poll(() => canvas(page)).toBe(original);

  // Guardado: lo pinta el servidor en cualquier página.
  await panel.getByRole('button', { name: 'Guardar tema' }).click();
  await expect(panel.getByRole('status').last()).toHaveText(/Tema guardado/);
  await expect.poll(() => canvas(page)).toBe(SEPIA_CANVAS);
  expect(await savedCss(request)).toMatch(/--canvas: #f3ead8;/);
  await expectAccessible(page);

  await page.goto('/hoy');
  await expect(page.locator('style[data-custom-theme]')).toHaveCount(1);
  expect(await canvas(page)).toBe(SEPIA_CANVAS);

  // Guardar los demás ajustes no lo borra.
  await page.goto('/ajustes');
  await page.getByLabel('Objetivo diario (minutos)').fill('45');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Ajustes guardados.')).toBeVisible();
  expect(await savedCss(request)).toMatch(/--canvas: #f3ead8;/);

  // Modo seguro: en esa página no se aplica, y desde ahí se puede quitar.
  await page.goto('/hoy?sin-tema');
  await expect(page.locator('style[data-custom-theme]')).toHaveCount(0);
  expect(await canvas(page)).toBe(original);
  await page.goto('/ajustes?sin-tema');
  await expect(page.getByText('Modo seguro: tu tema está guardado')).toBeVisible();
  await page.locator('#tema').getByRole('button', { name: 'Quitar tema' }).click();
  await expect(page.locator('#tema').getByRole('status').last()).toHaveText(/Tema quitado/);
  expect(await savedCss(request)).toBeNull();

  await page.goto('/hoy');
  await expect(page.locator('style[data-custom-theme]')).toHaveCount(0);
  expect(await canvas(page)).toBe(original);
  expect(errors).toEqual([]);
});

test('se sube un archivo .css, y lo que no es CSS no se acepta', async ({ page, request }) => {
  await signIn(page);
  await page.goto('/ajustes');
  const panel = page.locator('#tema');

  await panel.getByLabel('Subir un archivo .css').setInputFiles({
    name: 'mi-tema.css',
    mimeType: 'text/css',
    buffer: Buffer.from(':root, [data-theme] { --canvas: #000000; }\n'),
  });
  await expect(panel.getByLabel('CSS del tema')).toHaveValue(/--canvas: #000000;/);
  await expect(panel.getByText('mi-tema.css')).toBeVisible();
  await panel.getByRole('button', { name: 'Guardar tema' }).click();
  await expect.poll(() => canvas(page)).toBe('rgb(0, 0, 0)');

  // «<» podría cerrar la etiqueta <style>: se rechaza antes de probar o guardar.
  const field = panel.getByLabel('CSS del tema');
  await field.fill('body { color: red; } </style><script>alert(1)</script>');
  await panel.getByRole('button', { name: 'Probar sin guardar' }).click();
  await expect(panel.getByText('El CSS no puede llevar «<»')).toBeVisible();
  await expect(field).toHaveAttribute('aria-describedby', 'custom-theme-error');
  await panel.getByRole('button', { name: 'Guardar tema' }).click();
  await expect(panel.getByText('El CSS no puede llevar «<»')).toBeVisible();

  // Nada de cargar cosas de otras webs.
  await field.fill('@import url("https://example.com/tema.css");');
  await panel.getByRole('button', { name: 'Guardar tema' }).click();
  await expect(panel.getByText('Los @import no están permitidos')).toBeVisible();

  // Lo guardado sigue siendo el tema bueno.
  expect(await savedCss(request)).toMatch(/--canvas: #000000;/);
});
