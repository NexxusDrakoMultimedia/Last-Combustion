// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import {
  buyBackShares,
  declareDividend,
  ensureCapTables,
  garageValuation,
  issueShares,
  ownershipView,
  previewRound,
  recordValuations,
  roundInvestors,
} from '../../src/db/equity';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { endSeason } from '../../src/db/season';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { FOUNDING_SHARES } from '../../src/sim/equity';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Equity Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function world(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  return db;
}

describe('who owns each garage', () => {
  it('gives every racing garage its owners, adding up to the founding shares', () => {
    const db = world('equity-all');
    ensureCapTables(db);
    const garages = Number(scalar(db, "SELECT COUNT(*) FROM garage WHERE kind = 'racing'"));
    expect(garages).toBe(96);
    expect(Number(scalar(db, 'SELECT COUNT(DISTINCT garage_id) FROM shareholding'))).toBe(garages);
    const bad = db.exec(
      `SELECT garage_id, SUM(shares) AS s FROM shareholding GROUP BY garage_id HAVING s != ${FOUNDING_SHARES}`,
    );
    expect(bad).toEqual([]);
    // Every garage has a founder, and the mix has outside holders in it.
    expect(
      Number(
        scalar(
          db,
          "SELECT COUNT(DISTINCT garage_id) FROM shareholding WHERE holder_type = 'owner'",
        ),
      ),
    ).toBe(garages);
    expect(
      Number(
        scalar(
          db,
          "SELECT COUNT(DISTINCT garage_id) FROM shareholding WHERE holder_type = 'investor'",
        ),
      ),
    ).toBeGreaterThan(5);
  });

  it('draws the same owners for the same save, and changes nothing when run again', () => {
    const a = world('equity-same');
    const b = world('equity-same');
    ensureCapTables(a);
    ensureCapTables(b);
    const dump = (db: Database) =>
      JSON.stringify(db.exec('SELECT * FROM shareholding ORDER BY id')[0]!.values);
    expect(dump(a)).toBe(dump(b));
    const before = dump(a);
    ensureCapTables(a);
    expect(dump(a)).toBe(before);
  });

  it('makes the player the sole owner of the garage they found', () => {
    const db = world('equity-player');
    ensureCapTables(db);
    const id = foundPlayerGarage(db, setup);
    const rows = db.exec(
      `SELECT holder_type, holder_name, class, shares FROM shareholding WHERE garage_id = ${id}`,
    )[0]!.values;
    expect(rows).toEqual([['owner', 'Test Owner', 'ordinary', FOUNDING_SHARES]]);
    const view = ownershipView(db, id);
    expect(view.holders).toHaveLength(1);
    expect(view.holders[0]!.stake).toBe(1);
    expect(view.holders[0]!.votes).toBe(1);
  });

  it('gives a save from before ownership its owners when it loads', async () => {
    const db = world('equity-old');
    const id = foundPlayerGarage(db, setup);
    db.run('DELETE FROM shareholding');
    const { db: loaded } = await unpackDatabase(SQL, await packDatabase(db, 'old'));
    expect(Number(scalar(loaded, 'SELECT COUNT(DISTINCT garage_id) FROM shareholding'))).toBe(96);
    expect(scalar(loaded, `SELECT holder_name FROM shareholding WHERE garage_id = ${id}`)).toBe(
      'Test Owner',
    );
  });
});

describe('what a garage is worth', () => {
  it('starts as cash, cars, fans and prestige for a new garage', () => {
    const db = world('equity-value');
    const id = foundPlayerGarage(db, setup);
    createStarterOffers(db);
    const v = garageValuation(db, id);
    expect(v.profit).toBe(0);
    expect(v.titles).toBe(0);
    expect(v.fans).toBe(5 * 20);
    expect(v.prestige).toBe(2000);
    expect(v.total).toBe(v.cash + v.cars + v.fans + v.prestige);
    expect(v.cash).toBe(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${id}`)));
  });
});

describe('a season of ownership', () => {
  it('records every garage’s value when the season ends, and counts the profit and the titles', () => {
    const db = world('equity-season');
    const id = foundPlayerGarage(db, setup);
    createStarterOffers(db);
    for (let n = 1; n <= 6; n++) {
      playPrelims(db, n);
      playFinal(db, n);
      settleRound(db, n);
    }
    endSeason(db);
    expect(Number(scalar(db, "SELECT COUNT(*) FROM valuation WHERE date = '2031-11-11'"))).toBe(96);
    const view = ownershipView(db, id);
    expect(view.history).toEqual([{ date: '2031-11-11', value: expect.any(Number) }]);
    expect(view.sharePrice).toBeCloseTo(view.valuation.total / FOUNDING_SHARES, 6);
    // Recording again for the same date replaces the value rather than adding a row.
    recordValuations(db, '2031-11-11');
    expect(Number(scalar(db, `SELECT COUNT(*) FROM valuation WHERE garage_id = ${id}`))).toBe(1);
    // The champions' garages carry their titles in their value.
    const champion = Number(scalar(db, 'SELECT champion_garage_id FROM season'));
    expect(garageValuation(db, champion).titles).toBeGreaterThanOrEqual(1);
  }, 240_000);
});

function playerWorld(seed: string, cash = 5_000_000): { db: Database; id: number } {
  const db = world(seed);
  const id = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  db.run('UPDATE garage SET cash = ? WHERE id = ?', [cash, id]);
  return { db, id };
}

const cashOf = (db: Database, id: number) =>
  Number(scalar(db, `SELECT cash FROM garage WHERE id = ${id}`));

describe('raising money', () => {
  it('puts three investors on offer, the same until a round is done', () => {
    const { db, id } = playerWorld('round-offers');
    const a = roundInvestors(db, id);
    expect(a.order).toBe(1);
    expect(a.investors).toHaveLength(3);
    expect(roundInvestors(db, id)).toEqual(a);
  });

  it('issues preferred shares to the investor, pays the garage and dilutes the owner', () => {
    const { db, id } = playerWorld('round-issue');
    const before = cashOf(db, id);
    const quoted = previewRound(db, id, 0, 200_000);
    const terms = issueShares(db, id, 0, 200_000);
    expect(cashOf(db, id)).toBe(before + 200_000);
    expect(terms).toEqual(quoted);
    const view = ownershipView(db, id);
    const investor = view.holders.find((h) => h.type === 'investor')!;
    expect(investor.class).toBe('preferred');
    expect(investor.paid).toBe(200_000);
    expect(investor.stake).toBeCloseTo(terms.stake, 4);
    expect(view.holders.find((h) => h.type === 'owner')!.stake).toBeCloseTo(1 - terms.stake, 4);
    // Preferred shares do not vote, so the owner keeps every vote.
    expect(view.holders.find((h) => h.type === 'owner')!.votes).toBe(1);
    expect(
      Number(
        scalar(
          db,
          `SELECT amount FROM ledger WHERE garage_id = ${id} AND category = 'share_issue'`,
        ),
      ),
    ).toBe(200_000);
    expect(view.events[0]).toMatchObject({
      kind: 'round',
      detail: { round: 'Seed', amount: 200_000 },
    });
    // The next round has new investors and a new name.
    expect(roundInvestors(db, id).order).toBe(2);
    expect(view.round.name).toBe('Series A');
  });

  it('allows one round a year, a sensible amount, and no more than the share that may be given away', () => {
    const { db, id } = playerWorld('round-limits');
    expect(() => issueShares(db, id, 0, 10_000)).toThrow(/at least/);
    expect(() => issueShares(db, id, 0, 400_000_000)).toThrow(/too much/);
    expect(() => issueShares(db, id, 7, 200_000)).toThrow(/no such investor/);
    issueShares(db, id, 1, 200_000);
    expect(() => issueShares(db, id, 1, 200_000)).toThrow(/already raised/);
    expect(ownershipView(db, id).round.available).toBe(false);
  });

  it('is only for the player’s own garage', () => {
    const { db } = playerWorld('round-other');
    const other = Number(
      scalar(db, "SELECT id FROM garage WHERE is_player = 0 AND kind = 'racing' LIMIT 1"),
    );
    expect(() => issueShares(db, other, 0, 200_000)).toThrow(/only the player/i);
  });
});

describe('paying a dividend', () => {
  it('takes the money from the garage and gives the owner their part', () => {
    const { db, id } = playerWorld('dividend-basic');
    const before = cashOf(db, id);
    declareDividend(db, id, 100_000);
    expect(cashOf(db, id)).toBe(before - 100_000);
    expect(ownershipView(db, id).ownerCash).toBe(100_000);
    expect(
      Number(
        scalar(db, `SELECT amount FROM ledger WHERE garage_id = ${id} AND category = 'dividends'`),
      ),
    ).toBe(-100_000);
    expect(ownershipView(db, id).dividend.available).toBe(false);
    expect(() => declareDividend(db, id, 1_000)).toThrow(/already paid/);
  });

  it('shares the dividend with the other holders in proportion to their shares', () => {
    const { db, id } = playerWorld('dividend-split');
    const terms = issueShares(db, id, 0, 300_000);
    declareDividend(db, id, 100_000);
    const owner = ownershipView(db, id).ownerCash;
    // The owner holds the rest of the garage, so gets that share of the dividend.
    expect(owner).toBeGreaterThan(100_000 * (1 - terms.stake) - 2);
    expect(owner).toBeLessThan(100_000 * (1 - terms.stake) + 2);
    expect(owner).toBeLessThan(100_000);
  });

  it('cannot be nothing, or more than the garage holds', () => {
    const { db, id } = playerWorld('dividend-limits', 50_000);
    expect(() => declareDividend(db, id, 0)).toThrow(/more than nothing/);
    expect(() => declareDividend(db, id, 60_000)).toThrow(/cannot pay more/);
  });
});

describe('buying shares back', () => {
  it('lets the garage buy an investor out and cancel the shares', () => {
    const { db, id } = playerWorld('buyback-garage');
    issueShares(db, id, 0, 200_000);
    const holding = ownershipView(db, id).holders.find((h) => h.type === 'investor')!;
    const before = cashOf(db, id);
    const price = buyBackShares(db, id, holding.id, holding.shares, 'garage');
    expect(price).toBeGreaterThan(0);
    expect(cashOf(db, id)).toBe(before - price);
    const view = ownershipView(db, id);
    expect(view.holders.some((h) => h.type === 'investor')).toBe(false);
    expect(view.holders.find((h) => h.type === 'owner')!.stake).toBe(1);
    expect(view.events[0]).toMatchObject({ kind: 'buyback', detail: { by: 'garage', price } });
  });

  it('lets the owner buy shares with their own cash, once dividends have given them some', () => {
    const { db, id } = playerWorld('buyback-owner');
    issueShares(db, id, 0, 200_000);
    const holding = ownershipView(db, id).holders.find((h) => h.type === 'investor')!;
    expect(() => buyBackShares(db, id, holding.id, holding.shares, 'owner')).toThrow(/own cash/);
    db.run('UPDATE owner SET personal_cash = 10000000');
    const price = buyBackShares(db, id, holding.id, holding.shares, 'owner');
    expect(ownershipView(db, id).ownerCash).toBe(10_000_000 - price);
    const view = ownershipView(db, id);
    // The owner now holds the investor's preferred shares as well as their own ordinary ones.
    expect(view.holders.filter((h) => h.type === 'owner')).toHaveLength(2);
    expect(view.holders.some((h) => h.type === 'investor')).toBe(false);
  });

  it('can buy part of a holding and leaves the rest, and refuses bad requests', () => {
    const { db, id } = playerWorld('buyback-part');
    issueShares(db, id, 2, 200_000);
    const holding = ownershipView(db, id).holders.find((h) => h.type === 'investor')!;
    buyBackShares(db, id, holding.id, Math.floor(holding.shares / 2), 'garage');
    const left = ownershipView(db, id).holders.find((h) => h.type === 'investor')!;
    expect(left.shares).toBe(holding.shares - Math.floor(holding.shares / 2));
    expect(left.paid).toBeLessThan(holding.paid);
    expect(() => buyBackShares(db, id, holding.id, left.shares + 1, 'garage')).toThrow(
      /number of shares/,
    );
    const own = ownershipView(db, id).holders.find((h) => h.type === 'owner')!;
    expect(() => buyBackShares(db, id, own.id, 10, 'garage')).toThrow(/yourself/);
    expect(() => buyBackShares(db, id, 999_999, 10, 'garage')).toThrow(/no such holding/);
  });
});
