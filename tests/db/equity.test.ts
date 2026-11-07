// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import {
  ensureCapTables,
  garageValuation,
  ownershipView,
  recordValuations,
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
