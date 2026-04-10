import { expect } from '@playwright/test';
import { bootSetPoint, workflowTest } from './helpers/testHarness';

workflowTest('captures alignment screenshots for overview, follow ups, and tasks', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await bootSetPoint(page);

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.locator('.app-main-pane').screenshot({ path: testInfo.outputPath('overview-alignment.png') });

  await page.getByRole('button', { name: /Follow Ups/ }).click();
  await expect(page.getByRole('heading', { name: 'Follow Ups' })).toBeVisible();
  await page.locator('.app-main-pane').screenshot({ path: testInfo.outputPath('follow-ups-alignment.png') });

  await page.getByRole('button', { name: /^Tasks/ }).click();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  await page.locator('.app-main-pane').screenshot({ path: testInfo.outputPath('tasks-alignment.png') });
});
