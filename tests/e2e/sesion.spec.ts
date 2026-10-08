import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('con el email permitido y el código se entra y se ve Hoy', async ({ page, request }) => {
  const errors = trackErrors(page);
  await signIn(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Minutos de hoy: 0 de 45' })).toBeVisible();
  // Sin datos todavía, el nivel es el declarado (B1) y se marca como estimación poco fiable.
  await expect(
    page.getByRole('img', { name: 'Listening: B1, 50 % hacia B2' }).first(),
  ).toBeVisible();
  await expect(page.getByText('Estimación con pocos datos').first()).toBeVisible();

  const profiles = await queryDatabase(request, 'select daily_goal_min from public.profiles');
  expect(profiles).toEqual([{ daily_goal_min: 45 }]);

  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('con sesión, /login lleva a Hoy; al cerrar sesión se vuelve al acceso', async ({
  page,
  isMobile,
}) => {
  await signIn(page);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/hoy$/);

  if (isMobile) await page.getByRole('button', { name: 'Más' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/hoy');
  await expect(page).toHaveURL(/\/login$/);
});

test('un código incorrecto no abre sesión', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('owner@example.invalid');
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await page.getByLabel('Código de 6 dígitos').fill('000000');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('form').getByRole('alert')).toHaveText(
    'El código no es correcto o ha caducado. Pide uno nuevo.',
  );
  await page.goto('/hoy');
  await expect(page).toHaveURL(/\/login$/);
});

test('la navegación lleva a cada sección y marca la actual', async ({ page, isMobile }) => {
  await signIn(page);
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });

  await nav.getByRole('link', { name: 'Leer' }).click();
  await expect(page).toHaveURL(/\/leer$/);
  await expect(nav.getByRole('link', { name: 'Leer' })).toHaveAttribute('aria-current', 'page');

  if (isMobile) {
    await nav.getByRole('button', { name: 'Más' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Diario' }).click();
  } else {
    await nav.getByRole('link', { name: 'Diario' }).click();
  }
  await expect(page).toHaveURL(/\/diario$/);
});
