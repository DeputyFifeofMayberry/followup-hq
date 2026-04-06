import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest as test } from '../helpers/testHarness';

test('quick add supports direct import and review routing', async ({ page }) => {
  await bootSetPoint(page);

  const quickAddInput = page.getByPlaceholder(/Capture a follow-up or task/i);
  await quickAddInput.fill('Task: Prepare weld shop owner update for B995 due tomorrow owner Jared');
  await page.getByRole('button', { name: /Import now|Send to review/i }).first().click();

  await expect(page.getByText(/Imported now: task approved from Quick Add|Capture sent to Review/i)).toBeVisible();

  await quickAddInput.fill('reminder');
  await page.getByRole('button', { name: /Import now|Send to review/i }).first().click();
  await expect(page.getByText(/Capture sent to Review/i)).toBeVisible();
  await expect(page.getByText(/Intake Review queue/i)).toBeVisible();
});
