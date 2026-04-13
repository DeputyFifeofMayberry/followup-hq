import { expect, type Locator, type Page } from '@playwright/test';
import { bootSetPoint, workflowTest } from './helpers/testHarness';

async function readHorizontalRails(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Unable to read rail bounding box.');
  return {
    left: box.x,
    right: box.x + box.width,
  };
}

async function expectSharedRails(
  page: Page,
  bodyAnchorSelector: string,
  workspaceLabel: string,
) {
  const headerRails = await readHorizontalRails(page.locator('.workspace-header'));
  const bodyAnchorRails = await readHorizontalRails(page.locator(bodyAnchorSelector).first());

  expect.soft(Math.abs(headerRails.left - bodyAnchorRails.left), `${workspaceLabel}: left rail drift`).toBeLessThanOrEqual(2);
  expect.soft(Math.abs(headerRails.right - bodyAnchorRails.right), `${workspaceLabel}: right rail drift`).toBeLessThanOrEqual(2);
}

workflowTest('captures alignment screenshots for overview, follow ups, and tasks', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await bootSetPoint(page);

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expectSharedRails(page, '.overview-alignment-anchor', 'Overview');
  await page.locator('.app-main-pane').screenshot({ path: testInfo.outputPath('overview-alignment.png') });

  await page.getByRole('button', { name: /Follow Ups/ }).click();
  await expect(page.getByRole('heading', { name: 'Follow Ups' })).toBeVisible();
  await expectSharedRails(page, '.tracker-workspace-main', 'Follow Ups');
  await page.locator('.app-main-pane').screenshot({ path: testInfo.outputPath('follow-ups-alignment.png') });

  await page.getByRole('button', { name: /^Tasks/ }).click();
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();
  await expectSharedRails(page, '.task-workspace-main-card', 'Tasks');
  await page.locator('.app-main-pane').screenshot({ path: testInfo.outputPath('tasks-alignment.png') });
});
