// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { ensureSponsors, onBreak, rollBreaks, sponsorOffers } from '../../src/db/companies';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { sponsors } from '../../src/sim/sponsors';
import { SUPPLIERS } from '../../src/sim/supply';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Company Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function fresh(seed = 'companies'): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  return { db, garageId };
}

describe('sponsors in a save', () => {
  it('are all in a new world, and a save that lacks some gets them with the ids the data gives', () => {
    const { db } = fresh();
    expect(scalar(db, 'SELECT COUNT(*) FROM sponsor')).toBe(sponsors.length);
    db.run("DELETE FROM sponsor WHERE stable_id IN ('nova-pharma', 'atlas-mobility')");
    expect(scalar(db, 'SELECT COUNT(*) FROM sponsor')).toBe(sponsors.length - 2);
    ensureSponsors(db);
    expect(scalar(db, 'SELECT COUNT(*) FROM sponsor')).toBe(sponsors.length);
    expect(scalar(db, "SELECT id FROM sponsor WHERE stable_id = 'nova-pharma'")).toBe(
      sponsors.findIndex((s) => s.id === 'nova-pharma') + 1,
    );
    ensureSponsors(db);
    expect(scalar(db, 'SELECT COUNT(*) FROM sponsor')).toBe(sponsors.length);
  });
});

describe('companies coming and going', () => {
  it('withdraw for a few years, return, and leave no one out for good', () => {
    const { db } = fresh('companies-breaks');
    let withdrawn = 0;
    for (let year = 2032; year <= 2060; year++) withdrawn += rollBreaks(db, year);
    expect(withdrawn).toBeGreaterThan(10);
    // Every break is over in a few years, and by 2065 every company is back.
    expect(
      Number(scalar(db, 'SELECT MAX(to_year - from_year) FROM company_break')),
    ).toBeLessThanOrEqual(2);
    for (const s of db.exec('SELECT id FROM sponsor')[0]!.values)
      expect(onBreak(db, 'sponsor', s[0] as number, 2065)).toBe(false);
    for (const u of SUPPLIERS) expect(onBreak(db, 'utility', u.id, 2065)).toBe(false);
  });

  it('are the same for the same seed, and never take away a company with a deal in force', () => {
    const run = (seed: string) => {
      const { db } = fresh(seed);
      const sponsor = Number(scalar(db, 'SELECT id FROM sponsor ORDER BY id LIMIT 1'));
      db.run(
        'INSERT INTO sponsor_deal (garage_id, sponsor_id, start_year, end_year, season_fee, is_title) VALUES (1, ?, 2031, 2060, 1000, 1)',
        [sponsor],
      );
      for (let year = 2032; year <= 2050; year++) rollBreaks(db, year);
      expect(onBreak(db, 'sponsor', sponsor, 2040)).toBe(false);
      return JSON.stringify(
        db.exec('SELECT * FROM company_break ORDER BY kind, company_id, from_year'),
      );
    };
    expect(run('companies-same')).toBe(run('companies-same'));
  });

  it('keep a sponsor that is out of the series from being offered', () => {
    const { db, garageId } = fresh('companies-offers');
    const reach = 100;
    const before = sponsorOffers(db, garageId, reach);
    expect(before).toHaveLength(3);
    // Send every one of the three away for the year: none can be offered, and others take their places.
    for (const s of before) {
      const id = Number(scalar(db, `SELECT id FROM sponsor WHERE stable_id = '${s.id}'`));
      db.run(
        'INSERT INTO company_break (kind, company_id, from_year, to_year) VALUES (?, ?, 2031, 2032)',
        ['sponsor', id],
      );
    }
    const after = sponsorOffers(db, garageId, reach);
    expect(after).toHaveLength(3);
    for (const s of before) expect(after.some((x) => x.id === s.id)).toBe(false);
  });
});
