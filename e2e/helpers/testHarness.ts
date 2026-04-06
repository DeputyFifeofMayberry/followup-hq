import { expect, test, type Page } from '@playwright/test';
import { seedWorkflowLocalCache } from '../fixtures/workflowSeed';

export const workflowTest = test.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(seedWorkflowLocalCache);
    await use(page);
  },
});

export async function bootSetPoint(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Follow Ups' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tasks' })).toBeVisible();
}
