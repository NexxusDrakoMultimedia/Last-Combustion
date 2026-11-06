// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { expect, test } from '@playwright/test';
import messages from '../locales/en.json' with { type: 'json' };

test('plays a whole season, ends it, reads the almanac and starts the next one', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByLabel(messages['newCareer.ownerName']).fill('Season Owner');
  await page.getByLabel(messages['newCareer.garageName']).fill('Season Racing');
  await page.getByRole('button', { name: messages['newCareer.start'] }).click();
  await page.locator('input[name="starter-car"]').nth(1).check();
  await page.locator('input[name="starter-driver"]').nth(2).check();
  await page.getByRole('button', { name: messages['starter.confirm'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  for (let round = 1; round <= 6; round++) {
    await page.getByRole('button', { name: messages['hub.runPrelims'] }).click();
    await expect(page.getByText(new RegExp(`Round ${round} prelims: \\d+ set a time`))).toBeVisible(
      {
        timeout: 60_000,
      },
    );
    await page.getByRole('button', { name: messages['hub.runFinal'] }).click();
    await expect(page.getByText(new RegExp(`Round ${round} final: \\d+ finished`))).toBeVisible({
      timeout: 60_000,
    });
  }

  await page.getByRole('button', { name: messages['hub.endSeason'] }).click();
  await expect(page.getByText(/The 2031 season is over/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/awards? given out/)).toBeVisible();

  await page.getByRole('button', { name: messages['rail.almanac'] }).click();
  await expect(page.getByRole('heading', { name: '2031 season' })).toBeVisible();
  await expect(page.getByText(messages['award.fan_favourite'], { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: messages['almanac.tab.records'] }).click();
  await expect(page.getByText(messages['almanac.record.driver_points'])).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: messages['hub.nextSeason'] }).click();
  await expect(page.getByText(/Year 2032/)).toBeVisible({ timeout: 60_000 });
});
