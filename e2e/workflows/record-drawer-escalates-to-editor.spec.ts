import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('record drawer opens context and escalates to full editor', async ({ page }) => {
  await bootSetPoint(page);
  await page.getByRole('button', { name: /Follow Ups/ }).click();

  await page.getByText('Maintenance & deep edit').click();
  await page.getByRole('button', { name: /Open record context/i }).click();
  await expect(page.getByRole('heading', { name: /Record context/i })).toBeVisible();

  await page.getByRole('button', { name: /Edit full follow-up/i }).click();
  await expect(page.getByRole('button', { name: /Save changes/i })).toBeVisible();
  await expect(page.getByText(/Full edit is the deep destination/i)).toBeVisible();
});
