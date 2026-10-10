import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectAccessible } from './axe';
import { queryDatabase, resetDatabase, signIn, trackErrors } from './session';

// Fase 3 del roadmap sobre la lección de lectura: glosario por palabra, marcar desconocidas,
// cobertura «para ti», cosecha, sesión de repaso y la tabla de vocabulario.

const LESSON = 'b1-rea-001';
const TITLE = 'The Second Life of Old Games';

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

/** Deja la lección empezada en una fase, como si se hubiera hecho hasta ahí. */
async function resumeAt(request: APIRequestContext, lessonId: string, phase: number) {
  await queryDatabase(
    request,
    `insert into public.lesson_progress (user_id, lesson_id, status, phase)
     select id, $1, 'started', $2 from auth.users`,
    [lessonId, phase],
  );
}

const word = (page: Page, text: string) =>
  page
    .locator('[data-word]')
    .filter({ hasText: new RegExp(`^${text}$`) })
    .first();

const glossary = (page: Page, lemma: string) =>
  page.getByRole('dialog', { name: `Glosario: ${lemma}` });

async function coverageOf(page: Page): Promise<number> {
  await page.goto('/leer');
  const card = page.getByRole('link', { name: new RegExp(TITLE) });
  const text = await card.getByText(/Para ti: \d+ %/).innerText();
  return Number(/(\d+) %/.exec(text)?.[1]);
}

test('glosario por palabra, marcar desconocidas y cobertura «para ti»', async ({
  page,
  request,
  isMobile,
}) => {
  const errors = trackErrors(page);
  await signIn(page);

  // Con nivel B1 y el léxico vacío, casi todo el texto se da por conocido.
  const before = await coverageOf(page);
  expect(before).toBeGreaterThanOrEqual(90);
  expect(before).toBeLessThan(100);

  await resumeAt(request, LESSON, 4);
  await page.goto(`/leer/${LESSON}`);
  // (Al retomar, en pantallas estrechas se ve primero el texto, con el aviso de las ayudas.)
  await expect(page.getByText(/Toca una palabra para ver su glosario/)).toBeVisible();

  // Una palabra del glosario: definición en inglés, traducción, ejemplo y nivel.
  await word(page, 'release').click();
  const release = glossary(page, 'release');
  await expect(release).toContainText('the time when something new is made available');
  await expect(release).toContainText('lanzamiento');
  await expect(release).toContainText('Nombre');
  await expect(release).toContainText('A2');
  await expectAccessible(page);

  await release.getByRole('button', { name: 'Añadir al repaso' }).click();
  await expect(release.getByRole('button', { name: 'Ya está en el repaso' })).toBeDisabled();
  await expect(release).toContainText('En repaso');
  await page.keyboard.press('Escape');
  await expect(release).toBeHidden();
  await expect(word(page, 'release')).toHaveAttribute('data-lex', 'learning');

  // Una expresión se abre entera desde cualquiera de sus palabras.
  await word(page, 'die').click();
  const refuse = glossary(page, 'refuse');
  await expect(refuse).toContainText('negarse a');
  await refuse.getByRole('button', { name: 'No la conozco' }).click();
  await expect(refuse).toContainText('Desconocida');
  await refuse.getByRole('button', { name: 'Cerrar' }).click();
  await expect(word(page, 'refuse')).toHaveAttribute('data-lex', 'new');

  // Una palabra que no está en el glosario: solo se puede decir si se conoce.
  await word(page, 'company').click();
  const company = glossary(page, 'company');
  await expect(company).toContainText('no está en el glosario');
  await expect(company.getByRole('button', { name: 'Añadir al repaso' })).toHaveCount(0);
  await company.getByRole('button', { name: 'Ya la conozco' }).click();
  await expect(company).toContainText('Conocida');
  await page.keyboard.press('Escape');

  // Clic derecho (o pulsación larga): marca como desconocida sin abrir nada.
  await word(page, 'games').click({ button: 'right' });
  await expect(page.getByText('«game» marcada como desconocida')).toBeAttached();
  await expect(word(page, 'games')).toHaveAttribute('data-lex', 'new');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  if (!isMobile) {
    // Teclado: el texto es una parada del tabulador; las flechas mueven de palabra en palabra,
    // G abre el glosario y M marca.
    await word(page, 'When').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(word(page, 'video')).toBeFocused();
    await page.keyboard.press('m');
    await expect(word(page, 'video')).toHaveAttribute('data-lex', 'new');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-word][tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('g');
    await expect(glossary(page, 'a')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  await expectAccessible(page);

  // Lo guardado.
  const lexicon = await queryDatabase(
    request,
    `select lemma, status, source, cefr from public.lexicon
     where lemma in ('release', 'refuse', 'company', 'game') order by lemma`,
  );
  expect(lexicon).toEqual([
    { lemma: 'company', status: 'known', source: 'manual', cefr: 'A2' },
    { lemma: 'game', status: 'new', source: 'manual', cefr: 'A1' },
    { lemma: 'refuse', status: 'new', source: 'manual', cefr: 'B1' },
    { lemma: 'release', status: 'learning', source: 'srs', cefr: 'A2' },
  ]);

  const cards = await queryDatabase<Record<string, unknown>>(
    request,
    'select kind, lemma, source_lesson_id, source_segment_id, front, back, state from public.srs_cards',
  );
  expect(cards).toHaveLength(1);
  expect(cards[0]).toMatchObject({
    kind: 'word',
    lemma: 'release',
    source_lesson_id: LESSON,
    source_segment_id: `${LESSON}:p1s4`,
    state: 0,
    front: { surface: 'release' },
    back: { def_es: 'lanzamiento', pos: 'noun' },
  });
  // La frase de la tarjeta la pone el servidor a partir de la lección.
  expect((cards[0]?.front as { sentence: string }).sentence).toContain('Years after their release');

  // La cobertura de la biblioteca baja al marcar «game» (sale muchas veces en el texto).
  const after = await coverageOf(page);
  expect(after).toBeLessThan(before - 3);

  expect(errors).toEqual([]);
});

test('en la lectura en inmersión se puede marcar, pero no abrir el glosario', async ({
  page,
  request,
}) => {
  await signIn(page);
  await resumeAt(request, LESSON, 2);
  await page.goto(`/leer/${LESSON}`);
  await expect(page.getByRole('button', { name: 'He terminado de leer' })).toBeVisible();

  await word(page, 'forgotten').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await word(page, 'forgotten').click({ button: 'right' });
  await expect(word(page, 'forgotten')).toHaveAttribute('data-lex', 'new');
  await expect
    .poll(() => queryDatabase(request, `select status from public.lexicon where lemma = 'forget'`))
    .toEqual([{ status: 'new' }]);
});

test('cosecha al terminar, sesión de repaso con FSRS y tabla de vocabulario', async ({
  page,
  request,
  isMobile,
}) => {
  test.setTimeout(90_000);
  const errors = trackErrors(page);
  await signIn(page);
  await resumeAt(request, LESSON, 4);
  await page.goto(`/leer/${LESSON}`);

  // Consultar una palabra le da prioridad en la cosecha.
  await word(page, 'feedback').click();
  await expect(glossary(page, 'feedback')).toContainText('comentarios, opiniones');
  await page.keyboard.press('Escape');
  if (isMobile) await page.getByRole('button', { name: 'Preguntas', exact: true }).click();

  await page.getByLabel('Hueco 1').fill('Of course');
  await page.getByLabel('Hueco 2').fill('Still');
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver el resultado' }).click();

  // Cosecha: priorizada y con el límite de 8 por texto.
  const harvest = page.getByRole('region', { name: 'Cosecha' });
  await expect(harvest).toBeVisible();
  const items = harvest.getByRole('listitem');
  await expect(items.first()).toContainText('feedback');
  await expect(items.first()).toContainText('La consultaste');
  await expect(harvest.getByRole('checkbox', { checked: true })).toHaveCount(8);
  await expect(harvest.getByText('Poco frecuente').first()).toBeVisible();
  // Con el cupo lleno no se puede marcar otra sin quitar una.
  const rare = harvest.getByRole('checkbox', { name: /^modder/ });
  await expect(rare).toBeDisabled();
  await harvest.getByRole('checkbox', { name: /^feedback/ }).uncheck();
  await expect(rare).toBeEnabled();
  await harvest.getByRole('checkbox', { name: /^feedback/ }).check();
  await expectAccessible(page);

  await harvest.getByRole('button', { name: 'Añadir 8 al repaso' }).click();
  await expect(harvest.getByText('8 tarjetas añadidas al repaso.')).toBeVisible();
  await expect(harvest.getByRole('button', { name: /Añadir/ })).toHaveCount(0);

  const created = await queryDatabase<{ kind: string; lemma: string }>(
    request,
    'select kind, lemma from public.srs_cards order by lemma',
  );
  expect(created).toHaveLength(8);
  expect(created.map((c) => c.lemma)).toContain('feedback');
  // Con ocho palabras de tu nivel, las expresiones se quedan como sugerencia.
  expect(created.every((c) => c.kind === 'word')).toBe(true);
  await expect(harvest.getByRole('checkbox', { name: /^keep up with/ })).toBeDisabled();
  // Lo consultado quedó anotado al completar la lección, y ahora está en repaso.
  await expect
    .poll(() =>
      queryDatabase(
        request,
        `select status, lookup_count from public.lexicon where lemma = 'feedback'`,
      ),
    )
    .toEqual([{ status: 'learning', lookup_count: 1 }]);

  // «Hoy» avisa de lo que toca.
  await page.goto('/hoy');
  await expect(page.getByRole('link', { name: /Repaso/ })).toContainText('8 tarjetas tocan ahora');

  // Sesión de repaso.
  await page.goto('/repasar');
  await expect(page.getByText('0 de 8')).toBeVisible();
  await expect(page.getByText('Nuevas: 8')).toBeVisible();
  const rating = page.getByRole('group', { name: 'Valora cómo te ha ido' });
  await expect(rating).toHaveCount(0);
  await expectAccessible(page);

  // Primera tarjeta: se muestra con Espacio y se falla («Otra vez» → vuelve en 1 min).
  if (isMobile) await page.getByRole('button', { name: 'Mostrar' }).click();
  else await page.keyboard.press('Space');
  await expect(page.getByText('Ver traducción')).toBeVisible();
  await expect(rating.getByRole('button', { name: /Otra vez/ })).toContainText('1 min');
  await expect(rating.getByRole('button', { name: /Bien/ })).toContainText('10 min');
  await expect(rating.getByRole('button', { name: /Fácil/ })).toContainText(/\d+ d/);
  await expectAccessible(page);
  if (isMobile) await rating.getByRole('button', { name: /Otra vez/ }).click();
  else await page.keyboard.press('1');
  await expect(page.getByText('1 de 9')).toBeVisible();

  // Las otras siete: «Fácil» (se gradúan a días vista).
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: 'Mostrar' }).click();
    await rating.getByRole('button', { name: /Fácil/ }).click();
  }
  // Vuelve la fallada: «Bien» la deja en el paso de 10 min y, a la siguiente, «Fácil».
  await expect(page.getByText('Repasos: 1')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await rating.getByRole('button', { name: /Bien/ }).click();
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await rating.getByRole('button', { name: /Fácil/ }).click();

  await expect(page.getByRole('heading', { name: 'Sesión terminada' })).toBeVisible();
  await expect(page.getByText(/10 respuestas en \d+:\d\d\./)).toBeVisible();
  await expectAccessible(page);

  // El servidor ha recalculado y guardado los diez repasos.
  await expect
    .poll(async () => {
      const [row] = await queryDatabase<{ n: number }>(
        request,
        'select count(*)::int as n from public.srs_reviews',
      );
      return row?.n;
    })
    .toBe(10);
  const states = await queryDatabase<{ state: number; reps: number; scheduled_days: number }>(
    request,
    'select state, reps, scheduled_days from public.srs_cards order by reps',
  );
  expect(states.every((s) => s.state === 2 && s.scheduled_days >= 1)).toBe(true);
  expect(states.map((s) => s.reps)).toEqual([1, 1, 1, 1, 1, 1, 1, 3]);
  const ratings = await queryDatabase<{ rating: number; n: number }>(
    request,
    'select rating, count(*)::int as n from public.srs_reviews group by rating order by rating',
  );
  expect(ratings).toEqual([
    { rating: 1, n: 1 },
    { rating: 3, n: 1 },
    { rating: 4, n: 8 },
  ]);

  // Ya no queda nada para hoy.
  await page.goto('/repasar');
  await expect(page.getByRole('heading', { name: 'Nada pendiente' })).toBeVisible();
  await page.goto('/hoy');
  await expect(page.getByRole('link', { name: /Repaso/ })).toContainText('Nada pendiente ahora');

  // Vocabulario: lo cosechado está «en repaso», con su próximo repaso. El día es el de Madrid
  // también en el servidor, que va en UTC: las 23:30 UTC del 10 de enero son ya el 11. Si el
  // servidor y el navegador escribieran días distintos, React lo anotaría como error.
  await queryDatabase(request, `update public.srs_cards set due = '2027-01-10T23:30:00Z'`);
  await page.goto('/vocabulario');
  const table = page.getByRole('region', { name: 'Tabla de vocabulario' });
  await expect(table.getByRole('row')).toHaveCount(9);
  await expect(table.getByRole('row', { name: /feedback/ })).toContainText('En repaso');
  await expect(table.getByRole('row', { name: /feedback/ })).toContainText('11 ene');
  await expect(table.getByRole('row', { name: /feedback/ })).toContainText('B2');
  await expectAccessible(page);

  // Filtros por la URL.
  await page.getByLabel('Buscar palabra').fill('FEED');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  // (La búsqueda no distingue mayúsculas: el servidor la normaliza.)
  await expect(page).toHaveURL(/q=FEED/);
  await expect(table.getByRole('row')).toHaveCount(2);
  await page.getByLabel('Estado').selectOption({ label: 'Conocida' });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByRole('heading', { name: 'Nada con esos filtros' })).toBeVisible();
  await page.getByRole('link', { name: 'Quitar filtros' }).click();

  // Acción en bloque: darlas por conocidas pausa sus tarjetas.
  await table.getByRole('checkbox', { name: 'Seleccionar todas' }).check();
  await expect(page.getByText('8 seleccionadas')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como conocidas' }).click();
  await expect(table.getByText('Conocida')).toHaveCount(8);
  await expect(page.getByText('0 seleccionadas')).toBeVisible();
  const [suspended] = await queryDatabase<{ n: number }>(
    request,
    'select count(*)::int as n from public.srs_cards where suspended',
  );
  expect(suspended?.n).toBe(8);

  expect(errors).toEqual([]);
});

test('sin tarjetas, el repaso y el vocabulario explican por dónde empezar', async ({ page }) => {
  await signIn(page);
  await page.goto('/repasar');
  await expect(page.getByRole('heading', { name: 'Aún no tienes tarjetas' })).toBeVisible();
  await expectAccessible(page);
  await page.goto('/vocabulario');
  await expect(page.getByRole('heading', { name: 'Tu léxico está vacío' })).toBeVisible();
  await expectAccessible(page);
  await page.goto('/hoy');
  await expect(page.getByRole('link', { name: /Repaso/ })).toContainText('Nada pendiente ahora');
});
