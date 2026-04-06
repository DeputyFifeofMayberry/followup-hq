import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('follow-ups close action keeps lane momentum', async ({ page }) => {
  await bootSetPoint(page);
  await page.getByRole('button', { name: /Follow Ups/ }).click();

  const titleBefore = (await page.locator('.inspector-title').first().textContent())?.trim();
  await page.getByRole('button', { name: /^Close$/ }).first().click();
  await page.getByRole('button', { name: /Close follow-up/i }).click();

  await expect(page.getByText(/Follow-up closed|closed with override/i)).toBeVisible();
  const titleAfter = (await page.locator('.inspector-title').first().textContent())?.trim();
  expect(titleAfter).toBeTruthy();
  expect(titleAfter).not.toEqual(titleBefore);
});
