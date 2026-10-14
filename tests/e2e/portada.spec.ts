import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { trackErrors } from './session';

// El titular de la portada: la palabra se escribe y se borra, un idioma tras otro
// (design-system/senal/pages/portada.md, «Titular: la palabra que se escribe»).

const word = (page: Page) => page.locator('.typed-word');
const caret = (page: Page) => page.locator('.typed-caret');
// Para los lectores de pantalla el titular es siempre el mismo.
const heading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Domina el Inglés con Señal' });

/** Avanza el reloj de 30 en 30 ms hasta que la palabra sea `text`; devuelve lo que ha tardado. */
async function until(page: Page, text: string, limit: number): Promise<number> {
  let elapsed = 0;
  while ((await word(page).textContent()) !== text && elapsed < limit) {
    await page.clock.runFor(30);
    elapsed += 30;
  }
  await expect(word(page)).toHaveText(text);
  return elapsed;
}

test.describe('con movimiento', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('la palabra se escribe en 1 s, se queda 1,5 s y se borra en 1 s para dar paso a la siguiente', async ({
    page,
  }) => {
    // Con el reloj parado desde antes de cargar, solo avanza cuando lo pide el test: las medidas
    // son exactas, también la primera.
    const start = new Date('2026-10-14T10:00:00');
    await page.clock.install({ time: start });
    await page.clock.pauseAt(new Date(start.getTime() + 1000));
    await page.goto('/');
    await expect(word(page)).toHaveText('Inglés');
    await expect(caret(page)).toBeVisible();
    const height = (await heading(page).boundingBox())!.height;

    // Cada fase, medida en pasos de 30 ms del reloj (de ahí el margen).
    let current = 'Inglés';
    for (const next of ['Español', 'Francés', 'Chino', 'Japonés', 'Inglés']) {
      // Entera y quieta 1,5 s…
      const hold = await until(page, current.slice(0, -1), 3000);
      expect(hold, current).toBeGreaterThanOrEqual(1470);
      expect(hold, current).toBeLessThanOrEqual(1530);
      // …se borra en 1 s…
      const erasing = await until(page, '', 2000);
      expect(erasing, current).toBeGreaterThanOrEqual(970);
      expect(erasing, current).toBeLessThanOrEqual(1030);
      // …y la siguiente se escribe en 1 s, sea cual sea su longitud.
      const typing = await until(page, next, 2000);
      expect(typing, next).toBeGreaterThanOrEqual(970);
      expect(typing, next).toBeLessThanOrEqual(1030);

      // El titular no cambia de alto con ninguna palabra: nada de abajo se mueve.
      await expect(heading(page)).toBeVisible();
      expect((await heading(page).boundingBox())!.height, next).toBeCloseTo(height, 0);
      current = next;
    }
  });
});

test('con movimiento reducido se queda «Inglés», sin cursor', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.clock.runFor(20_000);
  await expect(word(page)).toHaveText('Inglés');
  await expect(caret(page)).toBeHidden();
  await expect(heading(page)).toBeVisible();
});

// «Crea tu plan»: la pantalla final del acercamiento (portada.md). Cuatro preguntas y un resumen.
const plan = (page: Page) => page.getByRole('form', { name: 'Crea tu plan' });
const step = (page: Page) => page.locator('#plan-paso');

test('sin acercamiento, «Crea tu plan» va en su sitio y lleva paso a paso al resumen', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(plan(page)).toBeVisible();
  await expect(step(page)).toHaveText('Paso 1 de 4');
  await expectAccessible(page);

  // Sin elegir no se avanza.
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(plan(page).getByRole('alert')).toHaveText('Elige una opción para seguir.');
  await expect(step(page)).toHaveText('Paso 1 de 4');

  await plan(page)
    .getByRole('radio', { name: /日本語/ })
    .check();
  await expect(plan(page).getByRole('alert')).toHaveText('');
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(step(page)).toHaveText('Paso 2 de 4');
  // El foco pasa a la primera respuesta del paso nuevo.
  await expect(plan(page).getByRole('radio', { name: /Empiezo de cero/ })).toBeFocused();

  // Se puede volver atrás y lo elegido sigue elegido.
  await plan(page).getByRole('button', { name: 'Atrás' }).click();
  await expect(step(page)).toHaveText('Paso 1 de 4');
  await expect(plan(page).getByRole('radio', { name: /日本語/ })).toBeChecked();
  await expect(plan(page).getByRole('radio', { name: /日本語/ })).toBeFocused();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();

  await plan(page)
    .getByRole('radio', { name: /Empiezo de cero/ })
    .check();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(step(page)).toHaveText('Paso 3 de 4');
  // El examen oficial es el del idioma elegido, y elegirlo añade una pregunta: cuándo es.
  const examGoal = plan(page).getByRole('radio', { name: /Aprobar el examen oficial/ });
  await expect(examGoal).toHaveAccessibleName(/JLPT/);
  await examGoal.check();
  await expect(step(page)).toHaveText('Paso 3 de 5');
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();

  await expect(step(page)).toHaveText('Paso 4 de 5');
  await plan(page).getByRole('radio', { name: 'En menos de 3 meses' }).check();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(step(page)).toHaveText('Paso 5 de 5');
  await plan(page).getByRole('radio', { name: '20 min' }).check();
  await plan(page).getByRole('button', { name: 'Ver mi plan' }).click();

  // El plan sale de las respuestas: meta, plazo, minutos, semana y por dónde empezar.
  await expect(step(page)).toHaveText('Listo');
  const summary = plan(page).locator('.plan-summary');
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('heading', { name: 'Tu plan de japonés' })).toBeVisible();
  const said = (name: string) => summary.locator(`[data-out="${name}"]`);
  await expect(said('respuestas')).toHaveText(
    'Japonés · Empiezo de cero (A1) · Aprobar el examen oficial · 20 min al día',
  );
  await expect(said('meta')).toHaveText('Tu meta: el JLPT N5, que equivale a un A1.');
  await expect(said('plazo')).toHaveText(
    'Suele llevar entre 325 y 575 horas de estudio. Con 20 min al día, de lunes a sábado, son unos 3–5,5 años.',
  );
  await expect(said('fecha')).toHaveText(
    'Para tu examen, en menos de 3 meses, no da tiempo ni con dos horas al día: mejor una convocatoria más adelante.',
  );
  // Los 20 minutos, repartidos sin perder ninguno; en japonés A1, una parte para la escritura.
  await expect(summary.getByRole('heading', { name: 'Tus 20 minutos' })).toBeVisible();
  await expect(said('reparto').locator('li').first()).toContainText('Kana y kanji');
  const total = await said('reparto')
    .locator('.plan-when')
    .allTextContents()
    .then((all) => all.reduce((sum, text) => sum + parseInt(text, 10), 0));
  expect(total).toBe(20);
  await expect(said('semana').locator('li').nth(1)).toContainText(
    'Un simulacro del JLPT N5, por partes',
  );
  await expect(said('pasos').locator('li')).toContainText([
    'Hiragana y katakana',
    'Saludos, números y tus primeras 100 palabras',
    'Tu primer simulacro del JLPT N5',
  ]);
  await expect(said('nota')).toHaveText(
    'Estamos preparando las lecciones de japonés. De momento, en Señal están las de inglés.',
  );
  await expect(summary.getByRole('link', { name: 'Empezar a estudiar' })).toHaveAttribute(
    'href',
    '/login',
  );
  await expectAccessible(page);

  // Otro plan: inglés desde el B1 para un examen dentro de unos meses, con poco tiempo al día.
  await summary.getByRole('button', { name: 'Cambiar respuestas' }).click();
  await expect(step(page)).toHaveText('Paso 1 de 5');
  await plan(page)
    .getByRole('radio', { name: /English/ })
    .check();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await plan(page)
    .getByRole('radio', { name: /Me defiendo/ })
    .check();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await plan(page).getByRole('radio', { name: 'Entre 6 meses y un año' }).check();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await plan(page).getByRole('radio', { name: '30 min' }).check();
  await plan(page).getByRole('button', { name: 'Ver mi plan' }).click();
  await expect(said('meta')).toHaveText('Tu meta: el B1 Preliminary.');
  await expect(said('plazo')).toHaveText(
    'Suele llevar entre 170 y 200 horas de estudio. Con 30 min al día, de lunes a sábado, son unos 13–15 meses.',
  );
  await expect(said('fecha')).toHaveText(
    'Para tu examen, en 6 meses–1 año, no llegas con 30 min al día: necesitarías unos 55 min al día.',
  );
  await expect(said('nota')).toContainText('ya están en Señal');

  // Sin examen no hay pregunta de fecha ni aviso del plazo; con «No lo sé», primero la prueba.
  await summary.getByRole('button', { name: 'Cambiar respuestas' }).click();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await plan(page)
    .getByRole('radio', { name: /No lo sé/ })
    .check();
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await plan(page)
    .getByRole('radio', { name: /Viajar/ })
    .check();
  await expect(step(page)).toHaveText('Paso 3 de 4');
  await plan(page).getByRole('button', { name: 'Siguiente' }).click();
  await expect(step(page)).toHaveText('Paso 4 de 4');
  await plan(page).getByRole('button', { name: 'Ver mi plan' }).click();
  await expect(said('meta')).toHaveText('Tu meta saldrá de la prueba de nivel.');
  await expect(said('fecha')).toBeHidden();
  await expect(said('pasos').locator('li').first()).toContainText('La prueba de nivel');
  expect(errors).toEqual([]);
});

test.describe('con el acercamiento', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('«Crea tu plan» aparece al final y se puede usar; la copia del portátil, no', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page.locator('.zoom-hero')).toHaveClass(/is-ready/);
    const app = page.locator('.zoom-app');
    await expect(app).not.toHaveClass(/is-live/);

    // La copia del portátil enseña el primer paso, sin ids repetidos y sin poder tocarse.
    const mini = page.locator('.zoom-mini');
    await expect(mini).toHaveAttribute('inert', '');
    await expect(mini.getByText('¿Qué idioma quieres aprender?')).toHaveCount(1);
    await expect(mini.locator('[id]')).toHaveCount(0);

    // Al final del acercamiento está a la vista y responde.
    await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>('.zoom-hero')!;
      window.scrollTo(0, hero.offsetTop + (hero.offsetHeight - window.innerHeight) * 0.9);
    });
    await expect(app).toHaveClass(/is-live/);
    await page.getByRole('radio', { name: /Français/ }).click();
    await expect(page.getByRole('radio', { name: /Français/ })).toBeChecked();
    // El examen del paso 3 ya es el del francés.
    await expect(page.locator('.zoom-app [data-exam]')).toHaveText('DELF y DALF');

    // Con el teclado se llega antes de verla: desde el último botón del titular, el tabulador
    // entra en el formulario y el recorrido avanza solo hasta que se ve.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(app).not.toHaveClass(/is-live/);
    await page.getByRole('link', { name: 'Saber Más' }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: /Français/ })).toBeFocused();
    await expect(app).toHaveClass(/is-live/);
    expect(errors).toEqual([]);
  });
});
