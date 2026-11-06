// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { expect, test } from '@playwright/test';
import messages from '../locales/en.json' with { type: 'json' };

test('draws every race number and every licence plate the same width', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(messages['newCareer.ownerName']).fill('Width Owner');
  await page.getByLabel(messages['newCareer.garageName']).fill('Width Racing');
  await page.getByRole('button', { name: messages['newCareer.start'] }).click();
  await page.locator('input[name="starter-car"]').nth(1).check();
  await page.locator('input[name="starter-driver"]').nth(2).check();
  await page.getByRole('button', { name: messages['starter.confirm'] }).click();
  await page.getByRole('button', { name: messages['rail.registry'] }).click();

  // Numbers from 1 to three digits all take the same room.
  await page.getByRole('tab', { name: /^Drivers/ }).waitFor();
  const numbers = page.getByRole('dialog').getByRole('img', { name: /^Number \d+/ });
  expect(await numbers.count()).toBeGreaterThan(200);
  const numberWidths = await numbers.evaluateAll((els) => [
    ...new Set(els.map((e) => Math.round(e.getBoundingClientRect().width))),
  ]);
  expect(numberWidths).toHaveLength(1);

  // Plates of 7 and 8 characters take the same room too.
  await page.getByRole('tab', { name: /^Cars/ }).click();
  const plates = page.getByRole('dialog').locator('[aria-label^="Licence plate"]');
  expect(await plates.count()).toBeGreaterThan(200);
  const plateWidths = await plates.evaluateAll((els) => [
    ...new Set(els.map((e) => Math.round(e.getBoundingClientRect().width))),
  ]);
  expect(plateWidths).toHaveLength(1);
  // The longest plate text fits inside its plate: nothing is cut off.
  const clipped = await plates.evaluateAll(
    (els) => els.filter((e) => e.scrollWidth > e.clientWidth).length,
  );
  expect(clipped).toBe(0);
});
