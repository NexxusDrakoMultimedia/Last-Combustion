// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { expect, test } from '@playwright/test';
import messages from '../locales/en.json' with { type: 'json' };

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('says the game is made for a computer, and lets the visitor carry on', async ({ page }) => {
    await page.goto('/');
    const notice = page.getByRole('dialog', { name: messages['mobile.title'] });
    await expect(notice).toBeVisible();
    await expect(notice.getByText(messages['mobile.body'])).toBeVisible();
    await notice.getByRole('button', { name: messages['mobile.continue'] }).click();
    await expect(notice).toBeHidden();
    // The choice is remembered, so a reload does not ask again.
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: messages['app.title'] }),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: messages['mobile.title'] })).toBeHidden();
  });
});

test.describe('on a computer', () => {
  test('shows no mobile notice, even on an upright screen', async ({ page }) => {
    await page.setViewportSize({ width: 1080, height: 1920 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: messages['app.title'] }),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: messages['mobile.title'] })).toHaveCount(0);
  });
});
