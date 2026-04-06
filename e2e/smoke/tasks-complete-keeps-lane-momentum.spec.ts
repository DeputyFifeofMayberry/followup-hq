import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('tasks complete action keeps queue progression', async ({ page }) => {
  await bootSetPoint(page);
  await page.getByRole('button', { name: /^Tasks/ }).click();

  const activeBefore = (await page.locator('.task-row.task-row-active .task-row-title').first().textContent())?.trim();
  await page.getByRole('button', { name: 'Complete' }).first().click();
  await page.getByRole('button', { name: /Mark done|Mark task done/ }).first().click();

  await expect(page.getByText(/Marked ".*" done/i)).toBeVisible();
  const activeAfter = (await page.locator('.task-row.task-row-active .task-row-title').first().textContent())?.trim();
  expect(activeAfter).toBeTruthy();
  expect(activeAfter).not.toEqual(activeBefore);
});
