import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('overview routes triage into follow-ups lane', async ({ page }) => {
  await bootSetPoint(page);

  await page.getByRole('button', { name: /route follow-ups/i }).click();

  await expect(page.getByRole('heading', { name: 'Follow-up execution lane' })).toBeVisible();
  await expect(page.getByText('Lane handoff')).toBeVisible();
  await expect(page.getByText('Selected follow-up')).toBeVisible();
});
