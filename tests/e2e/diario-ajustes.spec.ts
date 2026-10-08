import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test.describe('diario de input', () => {
  test('desde Hoy se registran 20 minutos de escucha con un toque y se puede deshacer', async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page);
    await signIn(page);

    // Un solo toque.
    await page.getByRole('button', { name: 'Registrar 20 minutos de escucha' }).click();
    await expect(page.getByText('Registrados 20 min de escucha.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Minutos de hoy: 20 de 45' })).toBeVisible();

    const rows = await queryDatabase(
      request,
      'select kind, source, minutes, title from public.input_log',
    );
    expect(rows).toEqual([
      { kind: 'extensive_listening', source: 'external', minutes: 20, title: null },
    ]);

    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.getByText('Registro deshecho.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Minutos de hoy: 0 de 45' })).toBeVisible();
    expect(await queryDatabase(request, 'select id from public.input_log')).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('el objetivo del día se marca como cumplido al alcanzarlo', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'Registrar 30 minutos de escucha' }).click();
    await expect(page.getByRole('img', { name: 'Minutos de hoy: 30 de 45' })).toBeVisible();
    await page.getByRole('button', { name: 'Registrar 20 minutos de lectura' }).click();
    await expect(page.getByRole('img', { name: 'Minutos de hoy: 50 de 45' })).toBeVisible();
    await expect(page.getByText('Objetivo cumplido')).toBeVisible();
  });

  test('el registro detallado aparece en la lista, suma en la semana y se puede borrar', async ({
    page,
    request,
  }) => {
    await signIn(page);
    await page.goto('/diario');
    await expect(page.getByRole('heading', { name: 'El diario está vacío' })).toBeVisible();
    await expectAccessible(page);

    await page.getByText('Con más detalle').click();
    await page.getByRole('radio', { name: 'Lectura' }).check();
    await page.getByRole('spinbutton', { name: 'Minutos' }).fill('75');
    await page.getByLabel('Nivel que te ha parecido').selectOption('B1');
    await page.getByLabel(/^Título/).fill('Libro graduado, capítulo 3');
    await page.getByLabel(/^Enlace/).fill('https://example.org/libro');
    await page.getByLabel(/^Palabras leídas/).fill('2100');
    await page.getByRole('button', { name: 'Añadir al diario' }).click();

    const entry = page.getByRole('listitem').filter({ hasText: 'Libro graduado, capítulo 3' });
    await expect(entry).toContainText('Lectura extensiva');
    await expect(entry).toContainText('Externo');
    await expect(entry).toContainText('2100 pal.');
    await expect(entry).toContainText('1 h 15 min');
    await expect(entry.getByRole('link')).toHaveAttribute('href', 'https://example.org/libro');
    await expect(entry.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    await expectAccessible(page);

    expect(
      await queryDatabase(request, 'select minutes, words, perceived_level from public.input_log'),
    ).toEqual([{ minutes: 75, words: 2100, perceived_level: 'B1' }]);

    await page
      .getByRole('button', { name: 'Borrar el registro «Libro graduado, capítulo 3»' })
      .click();
    await expect(page.getByRole('heading', { name: 'El diario está vacío' })).toBeVisible();
  });

  test('rechaza enlaces que no son http y minutos fuera de rango', async ({ page, request }) => {
    await signIn(page);
    await page.goto('/diario');
    await page.getByText('Con más detalle').click();
    await page.getByRole('spinbutton', { name: 'Minutos' }).fill('20');
    await page.getByLabel(/^Enlace/).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Añadir al diario' }).click();
    await expect(page.locator('form').getByRole('alert')).toContainText('Revisa los datos');

    await page.getByLabel(/^Enlace/).fill('');
    await page.getByRole('spinbutton', { name: 'Minutos' }).fill('9000');
    await page.getByRole('button', { name: 'Añadir al diario' }).click();
    await expect(page.locator('form').getByRole('alert')).toContainText('Revisa los datos');
    expect(await queryDatabase(request, 'select id from public.input_log')).toEqual([]);
  });
});

test.describe('ajustes', () => {
  test('se guardan objetivo, intereses, tema, letra e idioma, sin perder otros ajustes', async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page);
    await signIn(page);
    // Un ajuste que esta pantalla no gestiona y que debe sobrevivir al guardado.
    await queryDatabase(
      request,
      `update public.profiles set settings = '{"fsrs_params": [0.4, 1.2]}'::jsonb`,
    );

    await page.goto('/ajustes');
    await expectAccessible(page);

    await page.getByLabel('Objetivo diario (minutos)').fill('60');
    await page.getByRole('checkbox', { name: 'Ciencia y espacio' }).check();
    await page.getByRole('checkbox', { name: 'Videojuegos' }).check();
    await page.getByLabel('Tema', { exact: true }).selectOption('light');
    await page.getByLabel('Tamaño de letra del lector').fill('22');
    await page.getByLabel('Fondo de papel en el lector').check();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Ajustes guardados.')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expectAccessible(page);

    const [profile] = await queryDatabase<{
      daily_goal_min: number;
      interests: string[];
      ui_locale: string;
      settings: Record<string, unknown>;
    }>(request, 'select daily_goal_min, interests, ui_locale, settings from public.profiles');
    expect(profile).toMatchObject({ daily_goal_min: 60, ui_locale: 'es' });
    expect(profile?.interests.sort()).toEqual(['games', 'science-space']);
    expect(profile?.settings).toEqual({
      fsrs_params: [0.4, 1.2],
      theme: 'light',
      reading_font_px: 22,
      reader_paper: true,
      playback_rate: 1,
    });

    // El objetivo nuevo se ve en Hoy y el lector usa la letra y el papel elegidos.
    await page.goto('/hoy');
    await expect(page.getByRole('img', { name: 'Minutos de hoy: 0 de 60' })).toBeVisible();
    await page.goto('/leer/b1-rea-001');
    await page.getByRole('button', { name: 'Empezar el vistazo' }).click();
    const text = page.locator('[lang="en"].reading-md').first();
    await expect(text).toHaveCSS('font-size', '22px');
    await expect(page.locator('[data-theme="paper"]')).toBeVisible();
    await expectAccessible(page);

    // Interfaz en inglés.
    await page.goto('/ajustes');
    await page.getByLabel('Idioma de la interfaz').selectOption('en');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await page.goto('/hoy');
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Listening: B1, 50% towards B2' }).first(),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('no guarda un objetivo fuera de rango', async ({ page, request }) => {
    await signIn(page);
    await page.goto('/ajustes');
    await page.getByLabel('Objetivo diario (minutos)').fill('5');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'fuera de rango' })).toBeVisible();
    expect(await queryDatabase(request, 'select daily_goal_min from public.profiles')).toEqual([
      { daily_goal_min: 45 },
    ]);
  });
});
