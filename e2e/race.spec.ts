// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { expect, test, type Page } from '@playwright/test';
import messages from '../locales/en.json' with { type: 'json' };

/** Presses Continue until it is the button that runs the given step (it skips past the days and occasions between). */
async function continueTo(page: Page, label: string): Promise<void> {
  const primary = page.getByRole('button', {
    name: new RegExp(`^(${messages['calendar.continue']}|${label})$`),
  });
  for (let i = 0; i < 12; i++) {
    await expect(primary).toBeEnabled();
    if ((await primary.textContent())?.trim() === label) return;
    await primary.click();
  }
  throw new Error(`Never reached "${label}".`);
}

test('watches a final from the race screen: the tower, the steps and the flag', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByLabel(messages['newCareer.ownerName']).fill('Race Owner');
  await page.getByLabel(messages['newCareer.garageName']).fill('Race Watching');
  await page.getByRole('button', { name: messages['newCareer.start'] }).click();
  await page.locator('input[name="starter-car"]').nth(1).check();
  await page.locator('input[name="starter-driver"]').nth(2).check();
  await page.getByRole('button', { name: messages['starter.confirm'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await continueTo(page, messages['hub.runPrelims']);
  await page.getByRole('button', { name: messages['hub.runPrelims'] }).click();
  await expect(page.getByText(/Round 1 prelims: \d+ set a time/)).toBeVisible({ timeout: 60_000 });
  await continueTo(page, messages['hub.runFinal']);

  // Open the race screen instead of running the final, and start watching it.
  await page.getByRole('button', { name: messages['rail.race'], exact: true }).click();
  await page.getByRole('button', { name: messages['race.watch'] }).click();
  const tower = page.getByRole('table', { name: messages['race.tower'] });
  await expect(tower).toBeVisible();
  // A header row and the fifteen finalists, all with full tyres at the start.
  await expect(tower.getByRole('row')).toHaveCount(16);
  await expect(page.getByText(/^Lap 1 of \d+, sector 1 of \d+$/)).toBeVisible();

  await page.getByRole('button', { name: messages['race.next.sector'] }).click();
  await expect(page.getByText(/^Lap 1 of \d+, sector 2 of \d+$/)).toBeVisible();
  await page.getByRole('button', { name: messages['race.next.lap'] }).click();
  await expect(page.getByText(/^Lap 2 of \d+, sector 1 of \d+$/)).toBeVisible();

  // Play it to the flag: the race ends, the screen says so and the round is settled.
  await page.getByRole('button', { name: messages['race.next.end'] }).click();
  await expect(page.getByText(messages['race.over'])).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Round 1 final: \d+ finished/)).toBeVisible();
});
