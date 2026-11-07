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
  payAnnualDividend,
  ownershipView,
  previewRound,
  boardTargets,
  boardView,
  controlView,
  recordValuations,
  reviewBoard,
  roundInvestors,
} from '../../src/db/equity';
import { closeLedgerYear } from '../../src/db/ledger';
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
    // The board has reviewed the season against its target.
    const review = boardTargets(db, id).find((t) => t.year === 2031)!;
    expect(review.met).toBe(review.finish !== null && review.finish <= review.target);
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
    const offer = roundInvestors(db, id).investors[0]!;
    const terms = issueShares(db, id, 0, 200_000);
    expect(cashOf(db, id)).toBe(before + 200_000);
    expect(terms).toEqual(quoted);
    const view = ownershipView(db, id);
    const investor = view.holders.find((h) => h.type === 'investor')!;
    expect(investor.class).toBe(offer.class);
    expect(investor.paid).toBe(200_000);
    expect(investor.stake).toBeCloseTo(terms.stake, 4);
    expect(view.holders.find((h) => h.type === 'owner')!.stake).toBeCloseTo(1 - terms.stake, 4);
    // Preferred shares do not vote, so the owner keeps every vote; ordinary shares share the votes.
    expect(view.holders.find((h) => h.type === 'owner')!.votes).toBeCloseTo(
      offer.class === 'preferred' ? 1 : 1 - terms.stake,
      4,
    );
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

describe('the annual dividend', () => {
  /** Books an income (positive) or a loss (negative) in the 2031 financial year and closes it. */
  const bookYear = (db: Database, id: number, amount: number) => {
    db.run(
      "INSERT INTO ledger (garage_id, round_id, date, category, amount, note) VALUES (?, NULL, '2031-06-01', ?, ?, 'test')",
      [id, amount >= 0 ? 'sponsor' : 'wages', amount],
    );
    closeLedgerYear(db, 2031);
  };

  it('is paid by itself after a profit: half of it, to the holders, once a year', () => {
    const { db, id } = playerWorld('dividend-auto');
    bookYear(db, id, 400_000);
    const before = cashOf(db, id);
    expect(payAnnualDividend(db, id)).toBe(200_000);
    expect(cashOf(db, id)).toBe(before - 200_000);
    expect(ownershipView(db, id).ownerCash).toBe(200_000);
    expect(payAnnualDividend(db, id)).toBe(0);
    expect(cashOf(db, id)).toBe(before - 200_000);
  });

  it('is nothing after a loss, and never more than the garage holds', () => {
    const loss = playerWorld('dividend-loss');
    bookYear(loss.db, loss.id, -100_000);
    expect(payAnnualDividend(loss.db, loss.id)).toBe(0);
    const poor = playerWorld('dividend-poor', 50_000);
    bookYear(poor.db, poor.id, 400_000);
    expect(payAnnualDividend(poor.db, poor.id)).toBe(50_000);
    expect(cashOf(poor.db, poor.id)).toBe(0);
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

/** Gives the career a seed whose next round has an investor who insists on voting shares; returns who. */
function withVotingInvestor(db: Database, id: number): number {
  for (let i = 0; i < 400; i++) {
    db.run('UPDATE career SET master_seed = ? WHERE id = 1', [`votes-${i}`]);
    const n = roundInvestors(db, id).investors.findIndex((x) => x.class === 'ordinary');
    if (n >= 0) return n;
  }
  throw new Error('No seed with a voting investor was found.');
}

describe('control', () => {
  it('is complete for an owner who has sold only preferred shares', () => {
    const { db, id } = playerWorld('control-pref');
    const n = roundInvestors(db, id).investors.findIndex((x) => x.class === 'preferred');
    if (n >= 0) issueShares(db, id, n, 100_000);
    expect(controlView(db, id)).toMatchObject({ ownerVotes: 1, level: 'control', blockers: [] });
  });

  it('is shared with an investor who buys ordinary shares, who may block the reserved matters', () => {
    const { db, id } = playerWorld('control-vote', 20_000_000);
    const n = withVotingInvestor(db, id);
    // A big round (just under the limit) so the investor holds a blocking minority.
    let amount = 300_000;
    while (previewRound(db, id, n, amount + 100_000).stake <= 0.3 && amount < 50_000_000)
      amount += 100_000;
    const terms = issueShares(db, id, n, amount);
    const c = controlView(db, id);
    expect(c.ownerVotes).toBeCloseTo(1 - terms.stake, 4);
    expect(c.level).toBe('control');
    if (terms.stake >= 0.25) {
      expect(c.blockers).toHaveLength(1);
      // The next round is a reserved matter and the blocker refuses it, even after the year turns.
      db.run("UPDATE career SET game_date = '2032-02-01' WHERE id = 1");
      expect(() => issueShares(db, id, 0, 100_000)).toThrow(/vetoes new shares/);
    }
  });
});

describe('the board', () => {
  it('seats the owner, an investor with a tenth of the shares or more, and an independent chair', () => {
    const { db, id } = playerWorld('board-seats', 20_000_000);
    expect(boardView(db, id).map((d) => d.seat)).toEqual(['owner', 'chair']);
    const n = roundInvestors(db, id).investors.findIndex((x) => x.class === 'preferred');
    const terms = issueShares(db, id, n, 600_000);
    const seats = boardView(db, id);
    if (terms.stake >= 0.1)
      expect(seats.map((d) => d.seat)).toEqual(['owner', 'investor', 'chair']);
    const chair = seats.find((d) => d.seat === 'chair')!;
    // The chair is the same person every time for a save.
    expect(boardView(db, id).find((d) => d.seat === 'chair')!.name).toBe(chair.name);
  });

  it('sets a target the first time it is looked at and keeps it', () => {
    const { db, id } = playerWorld('board-target');
    const first = boardTargets(db, id);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ year: 2031, finish: null, met: null, vote: false });
    expect(first[0]!.target).toBeGreaterThanOrEqual(1);
    expect(boardTargets(db, id)).toEqual(first);
  });

  it('reviews the season against the target, and sets the next target at the finish', () => {
    const { db, id } = playerWorld('board-review');
    const target = boardTargets(db, id)[0]!.target;
    reviewBoard(db, id, 2031, target);
    expect(boardTargets(db, id)[0]).toMatchObject({ year: 2031, finish: target, met: true });
    db.run(
      "INSERT INTO season (year, era, final_size, series_fans, status) VALUES (2032, 'original', 15, 1000, 'active')",
    );
    const next = boardTargets(db, id)[0]!;
    expect(next.year).toBe(2032);
    expect(next.target).toBe(target);
  });

  it('calls a vote of no confidence after two missed targets when the owner is not in the majority', () => {
    const { db, id } = playerWorld('board-vote', 20_000_000);
    // Without a majority of the votes: the owner holds 40%.
    db.run(
      "INSERT INTO shareholding (garage_id, holder_type, holder_name, class, shares, paid, since) VALUES (?, 'investor', 'Majority Holder', 'ordinary', 1500000, 1, '2031-02-01')",
      [id],
    );
    boardTargets(db, id);
    reviewBoard(db, id, 2031, 90 + 20);
    expect(boardTargets(db, id)[0]!.vote).toBe(false);
    db.run(
      "INSERT INTO season (year, era, final_size, series_fans, status) VALUES (2032, 'original', 15, 1000, 'active')",
    );
    boardTargets(db, id);
    db.run('UPDATE board_target SET target = 1 WHERE year = 2031');
    reviewBoard(db, id, 2032, null);
    const rows = boardTargets(db, id);
    expect(rows.find((r) => r.year === 2032)).toMatchObject({ met: false, vote: true });
  });

  it('does not call a vote against an owner who holds the majority', () => {
    const { db, id } = playerWorld('board-majority');
    boardTargets(db, id);
    db.run('UPDATE board_target SET target = 1');
    reviewBoard(db, id, 2031, 50);
    db.run(
      "INSERT INTO season (year, era, final_size, series_fans, status) VALUES (2032, 'original', 15, 1000, 'active')",
    );
    boardTargets(db, id);
    db.run('UPDATE board_target SET target = 1 WHERE year = 2032');
    reviewBoard(db, id, 2032, 50);
    expect(boardTargets(db, id).some((r) => r.vote)).toBe(false);
  });
});
