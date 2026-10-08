import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Ninguna violación seria o crítica de WCAG 2.2 AA en la pantalla actual. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) =>
      v.nodes.map((node) => `${v.id} → ${node.target.join(' ')}: ${node.failureSummary}`),
    );
  expect(serious, 'violaciones serias de accesibilidad').toEqual([]);
}
