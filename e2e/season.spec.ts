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
    await continueTo(page, messages['hub.runPrelims']);
    await page.getByRole('button', { name: messages['hub.runPrelims'] }).click();
    await expect(page.getByText(new RegExp(`Round ${round} prelims: \\d+ set a time`))).toBeVisible(
      {
        timeout: 60_000,
      },
    );
    await continueTo(page, messages['hub.runFinal']);
    await page.getByRole('button', { name: messages['hub.runFinal'] }).click();
    await expect(page.getByText(new RegExp(`Round ${round} final: \\d+ finished`))).toBeVisible({
      timeout: 60_000,
    });
  }

  // The full tables and the full classification of a round, not just the leaders.
  await page.getByRole('button', { name: messages['rail.season'], exact: true }).click();
  await page.getByRole('tab', { name: messages['hub.table'] }).click();
  const standings = page.getByRole('table', { name: messages['tables.kind.drivers'] });
  await expect(standings).toBeVisible();
  expect(await standings.getByRole('row').count()).toBeGreaterThan(100);
  await page.locator('#standings-kind').selectOption('garages');
  await expect(page.getByRole('table', { name: messages['tables.kind.garages'] })).toBeVisible();
  await page.getByRole('tab', { name: messages['tables.results'] }).click();
  await page.getByRole('button', { name: messages['tables.session.prelims'] }).click();
  const prelims = page.getByRole('table', { name: messages['tables.session.prelims'] });
  await expect(prelims).toBeVisible();
  expect(await prelims.getByRole('row').count()).toBeGreaterThan(100);
  await page.locator('#results-round').selectOption('3');
  await page.getByRole('button', { name: messages['tables.session.final'] }).click();
  const finalTable = page.getByRole('table', { name: messages['tables.session.final'] });
  await expect(finalTable).toBeVisible();
  // Finalists carry a gold border on their number.
  await expect(finalTable.getByRole('img', { name: /gold border/ }).first()).toBeVisible();

  // Names, plates and rounds open profiles in the Registry, which link on to each other.
  await finalTable.getByRole('button').first().click();
  await expect(page.getByText(messages['registry.driverDecals'])).toBeVisible();
  await page
    .getByRole('table')
    .getByRole('button', { name: /Licence plate/ })
    .first()
    .click();
  await expect(page.getByText(messages['registry.carDecals'])).toBeVisible();
  await page.getByRole('button', { name: messages['registry.index'] }).click();
  // The index has a tab for each kind of thing; the Drivers tab opens first.
  await expect(page.getByRole('tab', { name: /^Drivers \(\d+\)/, selected: true })).toBeVisible();
  await page.getByRole('tab', { name: /^Cars \(\d+\)/ }).click();
  await expect(page.getByRole('button', { name: /Licence plate/ }).first()).toBeVisible();
  // Rounds are not in the Registry: their results are on the Season panel, not copied here.
  await expect(page.getByRole('tab', { name: /^Prelims and races/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // Delivery driving has paid the garage between the rounds, and the drivers' homes show.
  await page.getByRole('button', { name: messages['rail.money'] }).click();
  await expect(page.getByText(messages['money.category.delivery'])).toBeVisible();
  await expect(page.getByLabel(messages['ledger.year'])).toHaveValue('2031');
  await expect(page.getByText(messages['ledger.operating'])).toBeVisible();
  await expect(page.getByText(messages['ledger.running'])).toBeVisible();
  await page.getByRole('tab', { name: messages['ledger.tab.transactions'] }).click();
  await expect(page.getByRole('button', { name: messages['transactions.export'] })).toBeEnabled();
  await page.getByLabel(messages['transactions.category']).selectOption('delivery');
  await expect(
    page.getByRole('cell', { name: messages['money.category.delivery'] }).first(),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // The player owns every share of the garage, and the panel says what it is worth.
  await page.getByRole('button', { name: messages['rail.ownership'] }).click();
  await expect(page.getByRole('heading', { name: messages['ownership.holders'] })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Ordinary/ }).first()).toBeVisible();
  // The panel says who controls the garage and what the board expects.
  await expect(page.getByText(/You control the garage with 100% of the votes/)).toBeVisible();
  await expect(page.getByRole('heading', { name: messages['ownership.target'] })).toBeVisible();
  // Raising a small round brings in an investor and the money.
  await page.getByLabel(messages['ownership.raise.amount']).fill('50000');
  await page.getByRole('button', { name: /^Raise/ }).click();
  await expect(page.getByText(/^Seed:/)).toBeVisible();
  // The Investments tab lists the other garages and what a bid for one would do.
  await page.getByRole('tab', { name: messages['ownership.tab.investments'] }).click();
  await page.getByLabel(messages['investments.garage']).selectOption({ index: 1 });
  await expect(page.getByRole('heading', { name: messages['investments.takeover'] })).toBeVisible();
  await expect(page.getByText(messages['investments.takeover.closed'])).toBeVisible();
  await page.getByRole('tab', { name: messages['ownership.tab.mine'] }).click();
  // The owner's name opens their profile in the Registry.
  await page.getByRole('button', { name: 'Season Owner' }).first().click();
  await expect(page.getByRole('heading', { name: messages['person.holdings'] })).toBeVisible();
  // The same people are listed in the Registry's Paddock tab.
  await page.getByRole('button', { name: messages['registry.index'] }).click();
  await page.getByRole('tab', { name: /^Paddock/ }).click();
  await expect(page.getByRole('heading', { name: /^Owner \(\d+\)$/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Ex-Paddock/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('rowheader', { name: messages['ownership.part.total'] }),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await continueTo(page, messages['hub.endSeason']);
  await page.getByRole('button', { name: messages['hub.endSeason'] }).click();
  await expect(page.getByText(/The 2031 season is over/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/awards? given out/)).toBeVisible();

  await page.getByRole('button', { name: messages['rail.almanac'] }).click();
  await expect(page.getByRole('heading', { name: '2031 season' })).toBeVisible();
  await expect(page.getByText(messages['award.fan_favourite'], { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: messages['almanac.tab.records'] }).click();
  await expect(page.getByText(messages['almanac.record.driver_points'])).toBeVisible();
  await page.keyboard.press('Escape');

  // In the off-season a driver can book a move home.
  await page.getByRole('button', { name: messages['rail.drivers'] }).click();
  await expect(page.getByRole('heading', { name: messages['daily.title'] })).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Move .* to$/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  await continueTo(page, messages['hub.nextSeason']);
  await page.getByRole('button', { name: messages['hub.nextSeason'] }).click();
  await expect(page.getByText(/Year 2032/)).toBeVisible({ timeout: 60_000 });
});
