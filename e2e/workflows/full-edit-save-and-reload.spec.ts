import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('full edit updates follow-up/task and persists across reload', async ({ page }) => {
  await bootSetPoint(page);
  await page.getByRole('button', { name: /Follow Ups/ }).click();

  const followUpPatch = `Workflow confidence ${Date.now()}`;
  await page.getByRole('button', { name: /Edit full follow-up/i }).first().click();
  await page.getByLabel('Next action').fill(followUpPatch);
  await page.getByRole('button', { name: /Save changes/i }).click();
  await expect(page.getByText(followUpPatch)).toBeVisible();

  await page.getByRole('button', { name: /^Tasks/ }).click();
  const taskPatch = `Task next step ${Date.now()}`;
  await page.getByRole('button', { name: /Edit full task/i }).first().click();
  await page.getByLabel('Next step').fill(taskPatch);
  await page.getByRole('button', { name: /Save changes/i }).click();
  await expect(page.getByText(taskPatch)).toBeVisible();

  await page.reload();
  await expect(page.getByText(taskPatch)).toBeVisible();
  await page.getByRole('button', { name: /Follow Ups/ }).click();
  await expect(page.getByText(followUpPatch)).toBeVisible();
});
