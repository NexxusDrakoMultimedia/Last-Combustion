// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { peopleIndex, personProfile } from '../../src/db/people';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import {
  assignScout,
  garageScouts,
  hireScout,
  recentScoutRetirements,
  retireScouts,
  roundScoutWages,
  scoutCandidates,
} from '../../src/db/scouts';
import { persistWorld } from '../../src/db/world';
import { scoutingBalance } from '../../src/sim/worldgen/data';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed: string): { db: Database; garage: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  db.run('UPDATE garage SET cash = 100000000');
  return { db, garage: Number(scalar(db, 'SELECT garage_id FROM entry ORDER BY id LIMIT 1')) };
}

describe('a scout’s age', () => {
  it('is the age the offer gave, and grows with the years', () => {
    const { db, garage } = newCareer('scout-age');
    const offer = scoutCandidates(db, garage)[0]!;
    const scout = hireScout(db, garage, 0, 'drivers');
    expect(scout.age).toBe(offer.age);
    db.run("UPDATE career SET game_date = '2033-02-01'");
    expect(garageScouts(db, garage)[0]!.age).toBe(offer.age + 2);
  });
});

describe('retiring scouts', () => {
  const retireAge = scoutingBalance.staff.retireAge;

  it('sends home a scout who reaches the age, frees their assignment and their wage, and reports it', () => {
    const { db, garage } = newCareer('scout-retire');
    const old = hireScout(db, garage, 0, 'drivers');
    const young = hireScout(db, garage, 1, 'cars');
    const driver = Number(scalar(db, 'SELECT id FROM driver ORDER BY id LIMIT 1'));
    assignScout(db, garage, old.id, { kind: 'drivers', id: driver });
    assignScout(db, garage, young.id, { kind: 'drivers', id: driver });
    db.run('UPDATE scout SET birth_year = ? WHERE id = ?', [2032 - retireAge, old.id]);
    db.run('UPDATE scout SET birth_year = ? WHERE id = ?', [2032 - retireAge + 1, young.id]);
    const wagesBefore = roundScoutWages(db, garage);

    expect(retireScouts(db, 2031)).toEqual([]);
    const retired = retireScouts(db, 2032);
    expect(retired).toEqual([{ id: old.id, garageId: garage, name: old.name, age: retireAge }]);

    expect(garageScouts(db, garage).map((s) => s.id)).toEqual([young.id]);
    expect(scalar(db, `SELECT COUNT(*) FROM scout_assignment WHERE scout_id = ${old.id}`)).toBe(0);
    expect(scalar(db, `SELECT COUNT(*) FROM scout_assignment WHERE scout_id = ${young.id}`)).toBe(
      1,
    );
    expect(roundScoutWages(db, garage)).toBe(wagesBefore - old.wagePerRound);
    expect(scalar(db, `SELECT left_reason FROM scout WHERE id = ${old.id}`)).toBe('retired');
    expect(scalar(db, `SELECT left_on FROM scout WHERE id = ${old.id}`)).toBe('2032-02-01');

    db.run("UPDATE career SET game_date = '2032-02-01'");
    expect(recentScoutRetirements(db, garage)).toEqual(retired);
    expect(retireScouts(db, 2032)).toEqual([]);
  });

  it('lists scouts in the Paddock, and moves a retired one to the ex-paddock', () => {
    const { db, garage } = newCareer('scout-paddock');
    const scout = hireScout(db, garage, 0, 'garages');
    const listed = () => peopleIndex(db).find((p) => p.kind === 'scout' && p.id === scout.id)!;
    expect(listed()).toMatchObject({
      name: scout.name,
      role: 'scout',
      status: 'active',
      flag: scout.nationality,
    });
    expect(scout.nationality).toBeTruthy();
    expect(listed().garage).not.toBeNull();
    db.run('UPDATE scout SET birth_year = ? WHERE id = ?', [2031 - retireAge, scout.id]);
    retireScouts(db, 2031);
    expect(listed()).toMatchObject({ status: 'retired', garage: null });
    const profile = personProfile(db, 'scout', scout.id);
    expect(profile).toMatchObject({ kind: 'scout', leftReason: 'retired', age: retireAge });
    expect(() => personProfile(db, 'scout', 99999)).toThrow(/no scout/);
  });

  it('gives a scout hired before the age existed an age that never retires them at once', () => {
    const { db, garage } = newCareer('scout-old-save');
    const scout = hireScout(db, garage, 0, 'drivers');
    // What the migration does to a scout row that has no age yet.
    db.run('UPDATE scout SET birth_year = 0');
    db.run(
      'UPDATE scout SET birth_year = CAST(substr(hired_on, 1, 4) AS INTEGER) - (30 + id % 20)',
    );
    const age = garageScouts(db, garage)[0]!.age;
    expect(age).toBeGreaterThanOrEqual(30);
    expect(age).toBeLessThan(50);
    expect(retireScouts(db, 2031)).toEqual([]);
    expect(scout.id).toBeGreaterThan(0);
  });
});
