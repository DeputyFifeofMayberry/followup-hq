import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('app boot shows authenticated shell and trust controls', async ({ page }) => {
  await bootSetPoint(page);

  await expect(page.getByText('SetPoint personal execution workspace')).toBeVisible();
  await expect(page.getByText('Quick Add')).toBeVisible();
  await expect(page.getByText('Sync')).toBeVisible();
  await expect(page.getByText('Overview triage')).toBeVisible();
});
