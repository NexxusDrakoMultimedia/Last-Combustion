// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { expect, test } from '@playwright/test';
import messages from '../locales/en.json' with { type: 'json' };

test('creates, saves and reloads a career in the browser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: messages['app.title'] })).toBeVisible();

  await page.getByRole('button', { name: messages['debug.createCareer'] }).click();
  await expect(page.getByText(/Database schema version: \d+/)).toBeVisible();
  await expect(
    page.getByText('World: 96 garages, 313 drivers, 313 entries, 314 cars, 6 rounds'),
  ).toBeVisible();

  await page.getByRole('button', { name: messages['debug.runPrelims'] }).click();
  await expect(page.getByText(/Round 1 prelims: 7 prelim days/)).toBeVisible();
  await expect(page.getByText(/Pole: #\d+/)).toBeVisible();

  await page.getByRole('button', { name: messages['debug.saveSlot1'] }).click();
  await expect(page.getByText('1 save slot in use')).toBeVisible();

  // The save survives a page reload because it lives in IndexedDB.
  await page.reload();
  await expect(page.getByText('1 save slot in use')).toBeVisible();
  await page.getByRole('button', { name: messages['debug.loadSlot1'] }).click();
  await expect(page.getByText(messages['debug.loaded'])).toBeVisible();
  await expect(page.getByText(/Database schema version: \d+/)).toBeVisible();
  await expect(page.getByText(/World: 96 garages/)).toBeVisible();
});
