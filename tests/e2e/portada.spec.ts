import { expect, test, type Page } from '@playwright/test';

// El titular de la portada: la palabra se escribe y se borra, un idioma tras otro
// (design-system/senal/pages/portada.md, «Titular: la palabra que se escribe»).

const word = (page: Page) => page.locator('.typed-word');
const caret = (page: Page) => page.locator('.typed-caret');
// Para los lectores de pantalla el titular es siempre el mismo.
const heading = (page: Page) =>
  page.getByRole('heading', { level: 1, name: 'Domina el Inglés con Señal' });

/** Avanza el reloj de 60 en 60 ms hasta que la palabra sea `text`; devuelve lo que ha tardado. */
async function until(page: Page, text: string, limit: number): Promise<number> {
  let elapsed = 0;
  while ((await word(page).textContent()) !== text && elapsed < limit) {
    await page.clock.runFor(60);
    elapsed += 60;
  }
  await expect(word(page)).toHaveText(text);
  return elapsed;
}

test.describe('con movimiento', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('la palabra se escribe en 2–3 s, se queda 5 s y se borra para dar paso a la siguiente', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/');
    await expect(word(page)).toHaveText('Inglés');
    await expect(caret(page)).toBeVisible();
    const height = (await heading(page).boundingBox())!.height;

    await page.clock.runFor(4800);
    await expect(word(page)).toHaveText('Inglés');

    for (const next of ['Español', 'Francés', 'Chino', 'Japonés', 'Inglés']) {
      // Se borra la que hay…
      await until(page, '', 3000);
      // …y se escribe la siguiente, letra a letra.
      const typing = await until(page, next, 4000);
      expect(typing, next).toBeGreaterThanOrEqual(2000);
      expect(typing, next).toBeLessThanOrEqual(3060);

      // El titular no cambia de alto con ninguna palabra: nada de abajo se mueve.
      await expect(heading(page)).toBeVisible();
      expect((await heading(page).boundingBox())!.height, next).toBeCloseTo(height, 0);

      // Entera, se queda quieta 5 s.
      await page.clock.runFor(4800);
      await expect(word(page)).toHaveText(next);
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
