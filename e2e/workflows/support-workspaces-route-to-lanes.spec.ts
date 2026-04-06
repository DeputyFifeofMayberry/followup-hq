import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('projects and relationships route into execution lanes', async ({ page }) => {
  await bootSetPoint(page);

  await page.getByRole('button', { name: /^Projects/ }).click();
  await expect(page.getByRole('heading', { name: /Project command center/i })).toBeVisible();
  await page.getByRole('button', { name: /Open follow-up lane/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Follow-up execution lane' })).toBeVisible();

  await page.getByRole('button', { name: /^Relationships/ }).click();
  await expect(page.getByRole('heading', { name: /Relationship coordination board/i })).toBeVisible();
  await page.getByRole('button', { name: /Open task lane/i }).first().click();
  await expect(page.getByRole('heading', { name: /Task execution lane/i })).toBeVisible();
});
