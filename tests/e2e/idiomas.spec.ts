import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Cinco idiomas de interfaz (ADR-0032). Sin haber entrado, la web habla el idioma del navegador
// (o inglés si no es ninguno de los cinco); dentro, el que se elige en Ajustes.

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test.describe('con el navegador en francés', () => {
  test.use({ locale: 'fr-FR' });

  test('el acceso sale en francés, y se puede cambiar a otro idioma', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Connecte-toi à Señal' }),
    ).toBeVisible();

    const languages = page.getByRole('navigation', { name: 'Langue' });
    await expect(languages.getByRole('link')).toHaveText([
      'Español',
      'English',
      'Français',
      '简体中文',
      '日本語',
    ]);
    await expect(languages.getByRole('link', { name: 'Français' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expectAccessible(page);

    await languages.getByRole('link', { name: '日本語' }).click();
    await expect(page).toHaveURL(/\/login\?lang=ja$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('heading', { level: 1, name: 'Señal にログイン' })).toBeVisible();
    await expectAccessible(page);

    // Vale para esa página: sin `?lang`, vuelve el del navegador.
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    expect(errors).toEqual([]);
  });

  test('dentro manda el perfil, y en Ajustes se elige cualquiera de los cinco', async ({
    page,
    request,
  }) => {
    await signIn(page, '/login?lang=es');
    // El perfil dice español: el navegador en francés no cambia nada.
    await page.goto('/hoy');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    await page.goto('/ajustes');
    const select = page.getByLabel('Idioma de la interfaz');
    await expect(select.locator('option')).toHaveText([
      'Español',
      'English',
      'Français',
      '简体中文',
      '日本語',
    ]);
    await select.selectOption('zh');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('heading', { level: 1, name: '设置' })).toBeVisible();

    const [profile] = await queryDatabase<{ ui_locale: string }>(
      request,
      'select ui_locale from public.profiles',
    );
    expect(profile?.ui_locale).toBe('zh');

    await page.goto('/hoy');
    await expect(page.getByRole('heading', { level: 1, name: '今天' })).toBeVisible();
    // Los caracteres chinos salen de las fuentes chinas del sistema; lo latino, de Inter.
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).toMatch(/Inter.*PingFang SC.*Microsoft YaHei/);
    await expectAccessible(page);
  });
});

test.describe('con el navegador en un idioma que no está', () => {
  test.use({ locale: 'de-DE' });

  test('la web sale en inglés', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to Señal' })).toBeVisible();
  });
});

test.describe('con el navegador en japonés', () => {
  test.use({ locale: 'ja-JP' });

  test('el acceso sale en japonés, con las fuentes japonesas', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByRole('heading', { level: 1, name: 'Señal にログイン' })).toBeVisible();
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).toMatch(/Inter.*Hiragino Sans.*Yu Gothic/);
  });
});
