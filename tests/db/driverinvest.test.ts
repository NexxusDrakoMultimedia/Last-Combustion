// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { driversInvest } from '../../src/db/driverinvest';
import { ensureCapTables } from '../../src/db/equity';
import { driverHoldings, peopleIndex, personProfile } from '../../src/db/people';
import { driverProfile } from '../../src/db/registry';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { driverInvestment } from '../../src/sim/investing';
import { seasonBalance } from '../../src/sim/worldgen/data';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function world(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  ensureCapTables(db);
  return db;
}

describe('what a driver invests', () => {
  it('is half of what they have won, once it is worth it, and nothing before', () => {
    const { minEarnings, share } = seasonBalance.driverInvesting;
    expect(driverInvestment(minEarnings - 1)).toBe(0);
    expect(driverInvestment(0)).toBe(0);
    expect(driverInvestment(minEarnings)).toBe(Math.floor(minEarnings * share));
    expect(driverInvestment(1_000_000)).toBe(Math.floor(1_000_000 * share));
  });
});

describe('drivers investing their winnings', () => {
  it('buy shares from a holder, pay for them out of their earnings and change nobody else’s total', () => {
    const db = world('drivers-invest');
    db.run('UPDATE driver SET earnings = 2000000 WHERE id <= 5');
    const issuedBefore = Number(scalar(db, 'SELECT SUM(shares) FROM shareholding'));
    const bought = driversInvest(db, 2032);
    expect(bought.length).toBeGreaterThan(0);
    expect(bought.length).toBeLessThanOrEqual(5);
    for (const b of bought) {
      expect(b.shares).toBeGreaterThan(0);
      expect(b.cost).toBeGreaterThan(0);
      expect(b.cost).toBeLessThanOrEqual(1_000_000);
      expect(Number(scalar(db, `SELECT earnings FROM driver WHERE id = ${b.driverId}`))).toBe(
        2_000_000 - b.cost,
      );
      expect(
        scalar(
          db,
          `SELECT SUM(shares) FROM shareholding WHERE garage_id = ${b.garageId} AND holder_type = 'driver' AND holder_id = ${b.driverId}`,
        ),
      ).toBe(b.shares);
    }
    // Shares change hands, so the total issued is the same.
    expect(Number(scalar(db, 'SELECT SUM(shares) FROM shareholding'))).toBe(issuedBefore);
    // A driver with too little earns nothing from it.
    expect(driversInvest(db, 2033).every((b) => b.driverId <= 5)).toBe(true);
  });

  it('are the same for the same seed, and leave the player’s garage alone', () => {
    const run = (seed: string) => {
      const db = world(seed);
      db.run('UPDATE driver SET earnings = 2000000 WHERE id <= 8');
      return driversInvest(db, 2032);
    };
    expect(run('drivers-invest-same')).toEqual(run('drivers-invest-same'));
  });

  it('show on the driver’s profile, and the driver joins the Paddock only once they retire', () => {
    const db = world('drivers-invest-paddock');
    db.run('UPDATE driver SET earnings = 2000000 WHERE id <= 5');
    const bought = driversInvest(db, 2032);
    const first = bought[0]!;
    expect(driverHoldings(db, first.driverId).length).toBeGreaterThan(0);
    expect(driverProfile(db, first.driverId).holdings.length).toBeGreaterThan(0);
    const name = String(scalar(db, `SELECT name FROM driver WHERE id = ${first.driverId}`));
    const listed = () =>
      peopleIndex(db).find(
        (p) => p.kind === 'shareholder' && p.role === 'driver' && p.name === name,
      );
    // Still racing: not in the Paddock.
    expect(listed()).toBeUndefined();
    db.run('UPDATE driver SET retired_year = 2032 WHERE id = ?', [first.driverId]);
    const person = listed()!;
    expect(person).toBeDefined();
    const profile = personProfile(db, 'shareholder', person.id);
    expect(profile.kind === 'shareholder' && profile.driver?.id).toBe(first.driverId);
  });
});
