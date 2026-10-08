import { expect, test } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Fichas de gramática: índice con estado, ficha en MDX, mini-práctica corregida en el servidor
// y alta de los fallos en el repaso.

const FICHA = 'b1.linkers';
const TITLE = 'Linkers: although, however, in order to, unless, as long as';
/** Regla de un ítem: solo está en el frontmatter, así que no debe llegar antes de corregir. */
const RULE = 'Unless = if… not';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('el índice lista las fichas por nivel con su estado', async ({ page }) => {
  const errors = trackErrors(page);
  await signIn(page);
  await page.goto('/gramatica');

  await expect(page.getByRole('heading', { name: 'Nivel B1' })).toBeVisible();
  const cards = page.getByRole('main').getByRole('listitem');
  await expect(cards).toHaveCount(5);
  await expect(page.getByRole('link', { name: /Defining relative clauses/ })).toContainText(
    'Sin ver',
  );
  await expect(page.getByRole('link', { name: /Present perfect vs past simple/ })).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('ficha con mini-práctica: corrige el servidor y los fallos van al repaso', async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  const html: string[] = [];
  await page.route('**/*', async (route) => {
    if (!['document', 'fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      html.push(await response.text());
      await route.fulfill({ response });
    } catch {
      // La página se cerró con la petición en vuelo.
    }
  });

  await signIn(page);
  await page.goto('/gramatica');
  await page.getByRole('link', { name: new RegExp(TITLE) }).click();

  // La ficha: secciones fijas, tabla, ejemplos y enlaces.
  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  for (const section of [
    'En una frase',
    'Forma',
    'Uso',
    'Contraste con el español',
    'Errores típicos',
    'Cómo suena',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Condición negativa' })).toBeVisible();
  // El inglés de la ficha va marcado como inglés.
  await expect(page.locator('em[lang="en"]').first()).toBeVisible();
  await expect(page.getByText('Aunque el juego tiene quince años')).toBeVisible();
  // «Dónde aparece»: la lección de lectura trabaja esta estructura.
  await expect(page.getByRole('link', { name: 'The Second Life of Old Games' })).toBeVisible();
  await expectAccessible(page);

  // Abrirla la deja como «vista».
  await expect
    .poll(() =>
      queryDatabase(request, 'select status from public.lesson_progress where lesson_id = $1', [
        FICHA,
      ]),
    )
    .toEqual([{ status: 'started' }]);

  // Las respuestas y las reglas no han salido del servidor todavía.
  expect(html.some((body) => body.includes(RULE))).toBe(false);

  // Mini-práctica: tres aciertos (con mayúsculas y una variante), un fallo y uno en blanco.
  const check = page.getByRole('button', { name: 'Comprobar', exact: true });
  await expect(check).toBeDisabled();
  await page.getByLabel('Hueco 1').fill('even though');
  await page.getByLabel('Hueco 2').fill('HOWEVER');
  await page.getByLabel('Hueco 3').fill('order');
  await page.getByLabel('Hueco 4').fill('if');
  await check.click();

  const result = page.getByRole('status');
  await expect(result).toContainText('3 de 5 (60 %)');
  await expect(result).toContainText('2 fallos añadidos a tu repaso.');
  await expect(result).toBeFocused();
  await expect(page.getByText(RULE)).toBeVisible();
  await expect(page.getByText('No es correcto: unless')).toBeVisible();
  await expect(page.getByText('No es correcto: long')).toBeVisible();
  await expectAccessible(page);

  const attempts = await queryDatabase(
    request,
    `select item_id, skill, score from public.item_attempts order by item_id`,
  );
  expect(attempts).toEqual([
    { item_id: `${FICHA}:p1`, skill: 'grammar', score: 1 },
    { item_id: `${FICHA}:p2`, skill: 'grammar', score: 1 },
    { item_id: `${FICHA}:p3`, skill: 'grammar', score: 1 },
    { item_id: `${FICHA}:p4`, skill: 'grammar', score: 0 },
    { item_id: `${FICHA}:p5`, skill: 'grammar', score: 0 },
  ]);
  const cards = await queryDatabase<{ source_segment_id: string; back: { answers: string[] } }>(
    request,
    `select source_segment_id, back from public.srs_cards where kind = 'grammar'
     order by source_segment_id`,
  );
  expect(cards.map((c) => c.source_segment_id)).toEqual([`${FICHA}:p4`, `${FICHA}:p5`]);
  expect(cards[0]?.back.answers).toEqual(['unless']);

  // El índice la da por practicada.
  await page.goto('/gramatica');
  await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toContainText('Practicada');

  // Repetir con todo bien: dominada, y no se duplican las tarjetas.
  await page.getByRole('link', { name: new RegExp(TITLE) }).click();
  await page.getByLabel('Hueco 1').fill('Although');
  await page.getByLabel('Hueco 2').fill('However');
  await page.getByLabel('Hueco 3').fill('order');
  await page.getByLabel('Hueco 4').fill('unless');
  await page.getByLabel('Hueco 5').fill('long');
  await check.click();
  await expect(page.getByRole('status')).toContainText('5 de 5 (100 %)');
  await expect(page.getByRole('status')).not.toContainText('añadido');
  await page.goto('/gramatica');
  await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toContainText('Dominada');
  const [count] = await queryDatabase<{ n: number }>(
    request,
    'select count(*)::int as n from public.srs_cards',
  );
  expect(count?.n).toBe(2);

  // Las tarjetas de gramática se corrigen solas en el repaso.
  await page.goto('/repasar');
  await expect(page.getByText('Nuevas: 2')).toBeVisible();
  const rating = page.getByRole('group', { name: 'Valora cómo te ha ido' });
  const answers: Record<string, string> = { 'city lights': 'unless', telescope: 'long' };
  for (let i = 0; i < 2; i++) {
    // (Una tarjeta nueva valorada «Bien» sigue en aprendizaje y vuelve en la misma sesión.)
    await expect(page.getByText(i === 0 ? '0 de 2' : '1 de 3')).toBeVisible();
    const prompt = await page.locator('form p[lang="en"]').innerText();
    const key = Object.keys(answers).find((k) => prompt.includes(k)) ?? '';
    // Una bien y otra mal, para ver las dos valoraciones automáticas.
    await page.getByLabel('Tu respuesta').fill(i === 0 ? (answers[key] ?? '') : 'because');
    await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
    const suggested = rating.getByRole('button', { name: /sugerida/ });
    if (i === 0) {
      await expect(page.getByText('Correcto', { exact: true })).toBeVisible();
      await expect(suggested).toContainText('Bien');
    } else {
      await expect(page.getByText('No es correcto', { exact: true })).toBeVisible();
      await expect(suggested).toContainText('Otra vez');
      await expect(page.getByRole('link', { name: /Ver la ficha/ })).toHaveAttribute(
        'href',
        `/gramatica/${FICHA}`,
      );
      await expectAccessible(page);
    }
    // Intro confirma la valoración sugerida.
    await expect(suggested).toBeFocused();
    await page.keyboard.press('Enter');
  }
  // La fallada vuelve dentro de la misma sesión.
  await expect(page.getByText('2 de 4')).toBeVisible();

  expect(errors).toEqual([]);
});

test('una ficha que no existe muestra «no encontrada»', async ({ page }) => {
  await signIn(page);
  for (const path of ['/gramatica/b1.no-existe', '/gramatica/..%2F..%2Fpackage']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Aquí no hay nada' })).toBeVisible();
  }
});
