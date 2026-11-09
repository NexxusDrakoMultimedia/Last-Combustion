// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { ensureCapTables } from '../../src/db/equity';
import { ensureOrigins } from '../../src/db/origins';
import { peopleIndex, personProfile } from '../../src/db/people';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { nameLists } from '../../src/sim/worldgen/data';
import { nationsOfName } from '../../src/sim/worldgen/names';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Origins Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function fresh(seed = 'origins'): { db: Database; garageId: number } {
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
  ensureCapTables(db);
  return { db, garageId };
}

describe('where people and companies are from', () => {
  it('finds the nations whose lists have a name', () => {
    const au = nameLists.byNationality.AU!;
    expect(nationsOfName(`${au.male[0]} ${au.surnames[0]}`)).toContain('AU');
    expect(nationsOfName('Zzzz Qqqq')).toEqual([]);
  });

  it('gives every shareholder, executive, mechanic and company an origin, once', () => {
    const { db, garageId } = fresh();
    db.run(
      "INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, hired_on) VALUES (?, 'finance_director', 'Hired Person', 1980, 70, 'employed', 100000, 2031, '2031-02-01')",
      [garageId],
    );
    db.run(
      "INSERT INTO staff (garage_id, name, skill, wage_per_week, hired_on) VALUES (?, 'Crew Person', 55, 800, '2031-02-01')",
      [garageId],
    );
    ensureOrigins(db);
    expect(scalar(db, 'SELECT COUNT(*) FROM executive WHERE nationality IS NULL')).toBe(0);
    expect(scalar(db, 'SELECT COUNT(*) FROM staff WHERE nationality IS NULL')).toBe(0);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM shareholding WHERE nationality IS NULL
          AND NOT (holder_type IN ('sponsor', 'manufacturer') AND holder_id IS NOT NULL)`,
      ),
    ).toBe(0);
    for (const t of ['manufacturer', 'sponsor', 'part_supplier'])
      expect(scalar(db, `SELECT COUNT(*) FROM ${t} WHERE hq_place_id IS NULL`), t).toBe(0);
    // A company's headquarters are in the country it is from.
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM manufacturer m JOIN place p ON p.id = m.hq_place_id WHERE p.country <> m.home_country',
      ),
    ).toBe(0);
    // Running it again changes nothing.
    const dump = () =>
      JSON.stringify([db.exec('SELECT * FROM executive'), db.exec('SELECT * FROM staff')]);
    const before = dump();
    ensureOrigins(db);
    expect(dump()).toBe(before);
  });

  it('puts executives and mechanics in their garage’s state, and an owner at the garage’s headquarters', () => {
    const { db, garageId } = fresh();
    db.run(
      "INSERT INTO staff (garage_id, name, skill, wage_per_week, hired_on) VALUES (?, 'Crew Person', 55, 800, '2031-02-01')",
      [garageId],
    );
    ensureOrigins(db);
    const state = String(scalar(db, `SELECT home_state FROM garage WHERE id = ${garageId}`));
    expect(
      scalar(
        db,
        `SELECT p.region FROM staff s JOIN place p ON p.id = s.residence_place_id WHERE s.name = 'Crew Person'`,
      ),
    ).toBe(state);
    expect(
      scalar(
        db,
        `SELECT residence_place_id = (SELECT hq_place_id FROM garage WHERE id = ${garageId})
           FROM shareholding WHERE garage_id = ${garageId} AND holder_type = 'owner'`,
      ),
    ).toBe(1);
  });

  it('is the same for the same seed', () => {
    const a = fresh('origins-same');
    const b = fresh('origins-same');
    ensureOrigins(a.db);
    ensureOrigins(b.db);
    const dump = (db: Database) =>
      JSON.stringify(
        db.exec(
          'SELECT nationality, hometown_place_id, residence_place_id FROM shareholding ORDER BY id',
        ),
      );
    expect(dump(a.db)).toBe(dump(b.db));
  });

  it('shows on the profiles and in the index: a flag for people, and a headquarters for companies', () => {
    const { db } = fresh();
    const people = peopleIndex(db);
    expect(people.filter((p) => p.kind !== 'utility').every((p) => p.flag !== null)).toBe(true);
    const owner = people.find((p) => p.kind === 'shareholder' && p.name === 'Test Owner')!;
    const profile = personProfile(db, 'shareholder', owner.id);
    expect(profile.kind).toBe('shareholder');
    if (profile.kind === 'shareholder') {
      expect(profile.origin?.flag).toBe(owner.flag);
      expect(profile.origin?.hometown?.name).toBeTruthy();
      expect(profile.origin?.residence?.name).toBeTruthy();
    }
    const maker = people.find((p) => p.kind === 'manufacturer')!;
    const company = personProfile(db, 'manufacturer', maker.id);
    expect('headquarters' in company && company.headquarters?.country).toBe(maker.flag);
  });

  it('writes a place the save lacks, for a save from before the place was in the data', () => {
    const { db } = fresh();
    ensureOrigins(db);
    db.run("DELETE FROM place WHERE stable_id = 'ws-salelologa'");
    expect(scalar(db, "SELECT COUNT(*) FROM place WHERE stable_id = 'ws-salelologa'")).toBe(0);
    // Nothing lacks an origin, so nothing is written.
    ensureOrigins(db);
    expect(scalar(db, "SELECT COUNT(*) FROM place WHERE stable_id = 'ws-salelologa'")).toBe(0);
    // Something that does lack one has the missing places written first.
    db.run('UPDATE sponsor SET hq_place_id = NULL WHERE id = 1');
    ensureOrigins(db);
    expect(scalar(db, "SELECT COUNT(*) FROM place WHERE stable_id = 'ws-salelologa'")).toBe(1);
  });
});
