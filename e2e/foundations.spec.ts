// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { expect, test } from '@playwright/test';
import messages from '../locales/en.json' with { type: 'json' };

test('starts a career, runs a round, saves and reloads in the browser', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: messages['app.title'] })).toBeVisible();

  await page.getByLabel(messages['newCareer.ownerName']).fill('Test Owner');
  await page.getByLabel(messages['newCareer.garageName']).fill('Test Garage Racing');
  await page.getByRole('button', { name: messages['newCareer.start'] }).click();

  await expect(page.getByText('Test Garage Racing').first()).toBeVisible();

  await page.locator('input[name="starter-car"]').nth(1).check();
  await page.locator('input[name="starter-driver"]').nth(2).check();
  await page.getByRole('button', { name: messages['starter.confirm'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: messages['hub.runPrelims'] }).click();
  await expect(page.getByText(/Round 1 prelims: \d+ set a time/)).toBeVisible();
  await page.getByRole('button', { name: messages['hub.runFinal'] }).click();
  await expect(page.getByText(/Round 1 final: \d+ finished/)).toBeVisible();
  await page.getByRole('button', { name: messages['rail.season'] }).click();
  await page.getByRole('tab', { name: messages['hub.table'] }).click();
  await expect(page.getByRole('table', { name: messages['hub.table'] })).toBeVisible();
  await page.screenshot({});
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: messages['shell.menu'] }).click();

  await page.getByRole('button', { name: messages['hub.save'] }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText(messages['debug.saved'])).toBeVisible();

  // The save survives a page reload because it lives in IndexedDB.
  await page.reload();
  await page.getByRole('button', { name: messages['hub.load'] }).click();
  await expect(page.getByText('Test Garage Racing').first()).toBeVisible();
  await expect(page.getByText(/Year 2031/)).toBeVisible();
});
