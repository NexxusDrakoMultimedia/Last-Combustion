// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// Plays the first round in a real browser and saves 1920 by 1080 screenshots of the game to
// assets/brand/screenshots/, so they can be remade for every release. Needs a built game
// (`pnpm build`) and Chromium (PLAYWRIGHT_CHROMIUM_PATH). It starts its own preview server.
// Usage: node scripts/screenshots.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import messages from '../locales/en.json' with { type: 'json' };

const out = resolve(process.cwd(), 'assets/brand/screenshots');
mkdirSync(out, { recursive: true });
const port = 4199;
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
});
const stop = () => server.kill();
process.on('exit', stop);

// Wait for the preview server.
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`http://localhost:${port}/`)).ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const shot = async (name) => {
  await page.screenshot({ path: resolve(out, name) });
  console.log(`assets/brand/screenshots/${name}`);
};

await page.goto(`http://localhost:${port}/`);
await shot('01-new-career.png');
await page.getByLabel(messages['newCareer.ownerName']).fill('Alex Mercer');
await page.getByLabel(messages['newCareer.garageName']).fill('Understeer Engineering');
await page.getByRole('button', { name: messages['newCareer.start'] }).click();
await page.locator('input[name="starter-car"]').first().waitFor();
await shot('02-starter-choice.png');
await page.locator('input[name="starter-car"]').nth(1).check();
await page.locator('input[name="starter-driver"]').nth(2).check();
await page.getByRole('button', { name: messages['starter.confirm'] }).click();
await page.getByRole('button', { name: messages['hub.runPrelims'] }).click();
await page.getByText(/Round 1 prelims/).waitFor({ timeout: 60000 });
await page.getByRole('button', { name: messages['hub.runFinal'] }).click();
await page.getByText(/Round 1 final/).waitFor({ timeout: 60000 });
await shot('03-garage-floor.png');

await page.getByRole('button', { name: messages['rail.season'], exact: true }).click();
await page.getByRole('tab', { name: messages['tables.results'] }).click();
await page.getByRole('button', { name: messages['tables.session.final'] }).click();
await page.getByRole('table', { name: messages['tables.session.final'] }).waitFor();
await shot('04-race-results.png');

// The winner's profile, opened from the results, then the Registry index.
await page
  .getByRole('table', { name: messages['tables.session.final'] })
  .getByRole('button')
  .first()
  .click();
await page.getByText(messages['registry.skills']).waitFor();
await shot('05-driver-profile.png');
await page.getByRole('button', { name: messages['registry.index'] }).click();
await page.getByRole('tab', { name: /^Drivers/ }).waitFor();
await shot('06-registry.png');

await browser.close();
stop();
