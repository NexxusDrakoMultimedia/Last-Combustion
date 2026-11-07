// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { ensureCapTables, ownershipView } from '../../src/db/equity';
import {
  buyStake,
  investmentTargets,
  investmentView,
  launchTakeover,
  quoteTakeover,
  reserveOf,
  sellStake,
  takeoverOpen,
  wealthOf,
} from '../../src/db/investments';
import { personProfile } from '../../src/db/people';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Invest Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function playerWorld(seed: string): { db: Database; id: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const id = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  ensureCapTables(db);
  db.run('UPDATE garage SET cash = 50000000 WHERE id = ?', [id]);
  db.run('UPDATE owner SET personal_cash = 50000000');
  return { db, id };
}

/** The cheapest computer garage to invest in. */
const cheapest = (db: Database) =>
  investmentTargets(db).sort((a, b) => a.valuation - b.valuation)[0]!;

describe('the garages to invest in', () => {
  it('are the open computer garages, with their worth', () => {
    const { db } = playerWorld('inv-list');
    const targets = investmentTargets(db);
    expect(targets.length).toBeGreaterThan(80);
    expect(targets.every((t) => t.valuation > 0 && t.stake === 0)).toBe(true);
    expect(targets.some((t) => t.name === 'Invest Test Racing')).toBe(false);
  });

  it('give each holding a price that is its worth plus the holder’s premium, the same every time', () => {
    const { db } = playerWorld('inv-price');
    const t = cheapest(db);
    const v = investmentView(db, t.id);
    for (const h of v.holders.filter((x) => x.class !== 'option')) {
      expect(h.reserve).toBe(reserveOf(db, h.id, h.type));
      const worth = (v.valuation * h.shares) / v.issued;
      expect(h.asking).toBe(Math.round(Math.round(worth) * (1 + h.reserve)));
    }
    expect(investmentView(db, t.id)).toEqual(v);
  });
});

describe('buying and selling a stake', () => {
  it('moves the shares to the owner for the asking price, out of their own cash', () => {
    const { db, id } = playerWorld('inv-buy');
    const t = cheapest(db);
    const holder = investmentView(db, t.id).holders.find((h) => h.type !== 'option')!;
    const before = wealthOf(db, id).personalCash;
    const price = buyStake(db, id, holder.id);
    expect(price).toBe(holder.asking);
    const w = wealthOf(db, id);
    expect(w.personalCash).toBe(before - price);
    expect(w.holdings).toHaveLength(1);
    expect(w.holdings[0]).toMatchObject({ garageId: t.id, shares: holder.shares });
    expect(w.holdings[0]!.worth).toBeGreaterThan(0);
    expect(w.total).toBe(w.personalCash + w.holdings[0]!.worth);
    expect(investmentView(db, t.id).holders.find((h) => h.mine)!.shares).toBe(holder.shares);
    // The shares are the owner’s, so the Registry lists them under the owner’s name.
    const owner = ownershipView(db, id).holders[0]!;
    const profile = personProfile(db, 'shareholder', owner.profileId);
    expect(profile.kind === 'shareholder' && profile.holdings.length).toBe(2);
  });

  it('refuses what the owner cannot afford, their own shares and the option pool', () => {
    const { db, id } = playerWorld('inv-buy-limits');
    const t = cheapest(db);
    const view = investmentView(db, t.id);
    const holder = view.holders[0]!;
    db.run('UPDATE owner SET personal_cash = 1');
    expect(() => buyStake(db, id, holder.id)).toThrow(/afford/);
    db.run('UPDATE owner SET personal_cash = 50000000');
    buyStake(db, id, holder.id);
    expect(() => buyStake(db, id, holder.id)).toThrow(/no such holding/);
    const mine = investmentView(db, t.id).holders.find((h) => h.mine)!;
    expect(() => buyStake(db, id, mine.id)).toThrow(/already hold/);
    expect(() => buyStake(db, id, 999_999)).toThrow(/no such holding/);
    expect(() => buyStake(db, 9999, holder.id)).toThrow(/only the player/i);
  });

  it('can be sold back to the garage at its worth, from the garage’s cash', () => {
    const { db, id } = playerWorld('inv-sell');
    const t = cheapest(db);
    buyStake(db, id, investmentView(db, t.id).holders[0]!.id);
    // The garage has the cash to buy the shares back.
    db.run('UPDATE garage SET cash = 50000000 WHERE id = ?', [t.id]);
    const worth = wealthOf(db, id).holdings[0]!.worth;
    const garageBefore = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${t.id}`));
    const cash = wealthOf(db, id).personalCash;
    expect(sellStake(db, id, t.id)).toBe(worth);
    expect(wealthOf(db, id).personalCash).toBe(cash + worth);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${t.id}`))).toBe(
      garageBefore - worth,
    );
    expect(wealthOf(db, id).holdings).toEqual([]);
    expect(() => sellStake(db, id, t.id)).toThrow(/hold no shares/);
  });

  it('is refused when the garage has not the cash to buy the shares back', () => {
    const { db, id } = playerWorld('inv-sell-broke');
    const t = cheapest(db);
    buyStake(db, id, investmentView(db, t.id).holders[0]!.id);
    db.run('UPDATE garage SET cash = 0 WHERE id = ?', [t.id]);
    expect(() => sellStake(db, id, t.id)).toThrow(/cannot afford/);
  });
});

describe('a takeover', () => {
  it('can only be launched between seasons, and not on a bad bid', () => {
    const { db, id } = playerWorld('take-limits');
    const t = cheapest(db);
    expect(takeoverOpen(db)).toBe(false);
    expect(() => launchTakeover(db, id, t.id, 1)).toThrow(/between seasons/);
    db.run("UPDATE season SET status = 'complete'");
    expect(takeoverOpen(db)).toBe(true);
    expect(() => launchTakeover(db, id, t.id, 5)).toThrow(/out of range/);
    expect(() => launchTakeover(db, id, id, 1)).toThrow(/your own garage/);
  });

  it('fails when too few of the votes accept, and when the garage cannot pay', () => {
    const { db, id } = playerWorld('take-fail');
    db.run("UPDATE season SET status = 'complete'");
    const t = investmentTargets(db).find((g) => !quoteTakeover(db, g.id, 0).success)!;
    expect(() => launchTakeover(db, id, t.id, 0)).toThrow(/votes accept/);
    db.run('UPDATE garage SET cash = 10 WHERE id = ?', [id]);
    expect(() => launchTakeover(db, id, t.id, 1)).toThrow(/cannot afford/);
  });

  it('carries when every holder accepts, buys them all out and merges the garage', () => {
    const { db, id } = playerWorld('take-carry');
    db.run("UPDATE season SET status = 'complete'");
    const t = cheapest(db);
    const before = {
      cash: Number(scalar(db, `SELECT cash FROM garage WHERE id = ${id}`)),
      fans: Number(scalar(db, `SELECT fans FROM garage WHERE id = ${id}`)),
      cars: Number(scalar(db, `SELECT COUNT(*) FROM car WHERE garage_id = ${id}`)),
    };
    const target = {
      cash: Number(scalar(db, `SELECT cash FROM garage WHERE id = ${t.id}`)),
      fans: Number(scalar(db, `SELECT fans FROM garage WHERE id = ${t.id}`)),
      cars: Number(scalar(db, `SELECT COUNT(*) FROM car WHERE garage_id = ${t.id}`)),
    };
    const quote = quoteTakeover(db, t.id, 1);
    expect(quote.success).toBe(true);
    const result = launchTakeover(db, id, t.id, 1);
    expect(result.cost).toBe(quote.cost);
    expect(result.cars).toBe(target.cars);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${id}`))).toBe(
      before.cash - quote.cost + target.cash,
    );
    expect(Number(scalar(db, `SELECT fans FROM garage WHERE id = ${id}`))).toBe(
      before.fans + target.fans,
    );
    expect(Number(scalar(db, `SELECT COUNT(*) FROM car WHERE garage_id = ${id}`))).toBe(
      before.cars + target.cars,
    );
    expect(Number(scalar(db, `SELECT COUNT(*) FROM car WHERE garage_id = ${t.id}`))).toBe(0);
    expect(
      db.exec(`SELECT cash, fans, acquired_by, closed_year FROM garage WHERE id = ${t.id}`)[0]!
        .values[0],
    ).toEqual([0, 0, id, 2031]);
    // It is gone from the cap tables and from the list of garages to invest in, and stays gone.
    expect(Number(scalar(db, `SELECT COUNT(*) FROM shareholding WHERE garage_id = ${t.id}`))).toBe(
      0,
    );
    ensureCapTables(db);
    expect(Number(scalar(db, `SELECT COUNT(*) FROM shareholding WHERE garage_id = ${t.id}`))).toBe(
      0,
    );
    expect(investmentTargets(db).some((g) => g.id === t.id)).toBe(false);
    expect(() => investmentView(db, t.id)).toThrow(/closed/);
    // Every movement of cash is in the ledger, and the history says what happened.
    expect(
      Number(
        scalar(
          db,
          `SELECT SUM(amount) FROM ledger WHERE garage_id = ${id} AND category = 'acquisitions'`,
        ),
      ),
    ).toBe(target.cash - quote.cost);
    expect(ownershipView(db, id).events[0]).toMatchObject({
      kind: 'takeover',
      detail: { garage: t.name, cars: target.cars },
    });
  });

  it('moves the driver contracts that run on, and ends the others', () => {
    const { db, id } = playerWorld('take-contracts');
    db.run("UPDATE season SET status = 'complete'");
    const t = cheapest(db);
    const runs = Number(
      scalar(db, `SELECT COUNT(*) FROM contract WHERE garage_id = ${t.id} AND end_year > 2031`),
    );
    const result = launchTakeover(db, id, t.id, 1);
    expect(result.drivers).toBe(runs);
    expect(
      Number(
        scalar(db, `SELECT COUNT(*) FROM contract WHERE garage_id = ${t.id} AND end_year > 2031`),
      ),
    ).toBe(0);
    expect(
      Number(
        scalar(db, `SELECT COUNT(*) FROM contract WHERE garage_id = ${id} AND end_year > 2031`),
      ),
    ).toBeGreaterThanOrEqual(runs);
  });

  it('charges nothing for the shares the owner already holds', () => {
    const { db, id } = playerWorld('take-own');
    db.run("UPDATE season SET status = 'complete'");
    const t = cheapest(db);
    const before = quoteTakeover(db, t.id, 1).cost;
    const biggest = investmentView(db, t.id)
      .holders.filter((h) => h.class !== 'option')
      .sort((a, b) => b.shares - a.shares)[0]!;
    buyStake(db, id, biggest.id);
    expect(quoteTakeover(db, t.id, 1).cost).toBeLessThan(before);
  });
});
