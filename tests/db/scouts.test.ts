// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import {
  assignScout,
  clearAssignment,
  fireScout,
  garageScouts,
  hireScout,
  risingDrivers,
  roundScoutWages,
  scoutCandidates,
  scoutsForEngine,
} from '../../src/db/scouts';
import { persistWorld } from '../../src/db/world';
import { readingMidpoint, scoutWageFor } from '../../src/sim/scouting';
import { scoutingBalance } from '../../src/sim/worldgen/data';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'scouts-db'): { db: Database; garage: number } {
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

describe('hiring and letting go', () => {
  it('starts with none, offers four and keeps the same offers until someone is hired', () => {
    const { db, garage } = newCareer();
    expect(garageScouts(db, garage)).toEqual([]);
    const offers = scoutCandidates(db, garage);
    expect(offers).toHaveLength(4);
    expect(scoutCandidates(db, garage)).toEqual(offers);
    const hired = hireScout(db, garage, 1, 'cars');
    expect(hired).toMatchObject({
      name: offers[1]!.name,
      skill: offers[1]!.skill,
      wagePerYear: offers[1]!.wagePerYear,
      focus: 'cars',
    });
    expect(offers[1]!.wagePerYear).toBe(scoutWageFor(offers[1]!.skill));
    expect(JSON.stringify(scoutCandidates(db, garage))).not.toBe(JSON.stringify(offers));
  });

  it('refuses a missing offer, a bad focus and a fifth scout', () => {
    const { db, garage } = newCareer('scouts-limit');
    expect(() => hireScout(db, garage, 9, 'drivers')).toThrow(/no such scout/);
    expect(() => hireScout(db, garage, 0, 'rivals' as never)).toThrow(/drivers, cars or garages/);
    for (let i = 0; i < scoutingBalance.staff.maxPerGarage; i++)
      hireScout(db, garage, 0, 'drivers');
    expect(() => hireScout(db, garage, 0, 'drivers')).toThrow(/at most/);
  });

  it('charges a round of wages as notice and frees the scout', () => {
    const { db, garage } = newCareer('scouts-fire');
    const s = hireScout(db, garage, 0, 'drivers');
    const before = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`));
    expect(fireScout(db, garage, s.id)).toBe(s.wagePerRound);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`))).toBe(
      before - s.wagePerRound,
    );
    expect(garageScouts(db, garage)).toEqual([]);
    expect(() => fireScout(db, garage, s.id)).toThrow(/does not employ/);
  });
});

describe('assignments', () => {
  it('assigns a scout to a real subject, replaces it, and clears it', () => {
    const { db, garage } = newCareer('scouts-assign');
    const s = hireScout(db, garage, 0, 'drivers');
    const driver = Number(scalar(db, 'SELECT id FROM driver ORDER BY id LIMIT 1'));
    assignScout(db, garage, s.id, { kind: 'drivers', id: driver });
    const again = garageScouts(db, garage)[0]!;
    expect(again.assignment).toEqual({ kind: 'drivers', id: driver });
    expect(again.subjectName).toBe(
      String(scalar(db, `SELECT name FROM driver WHERE id = ${driver}`)),
    );
    expect(scoutsForEngine(db, garage)[0]!.assignedTo).toBe(`drivers:${driver}`);
    assignScout(db, garage, s.id, { kind: 'garages', id: garage });
    expect(scalar(db, 'SELECT COUNT(*) FROM scout_assignment')).toBe(1);
    clearAssignment(db, garage, s.id);
    expect(garageScouts(db, garage)[0]!.assignment).toBeNull();
  });

  it('refuses a subject that does not exist and a scout the garage does not employ', () => {
    const { db, garage } = newCareer('scouts-bad');
    const s = hireScout(db, garage, 0, 'drivers');
    expect(() => assignScout(db, garage, s.id, { kind: 'drivers', id: 999999 })).toThrow(
      /nothing like that/,
    );
    expect(() => assignScout(db, garage, 999, { kind: 'drivers', id: 1 })).toThrow(
      /does not employ/,
    );
  });

  it('drops the assignment when the scout is let go', () => {
    const { db, garage } = newCareer('scouts-drop');
    const s = hireScout(db, garage, 0, 'drivers');
    assignScout(db, garage, s.id, { kind: 'garages', id: garage });
    fireScout(db, garage, s.id);
    expect(scalar(db, 'SELECT COUNT(*) FROM scout_assignment')).toBe(0);
  });
});

describe('wages', () => {
  it('are paid in the round settlement beside the mechanics', () => {
    const { db, garage } = newCareer('scouts-wages');
    const s = hireScout(db, garage, 0, 'drivers');
    expect(roundScoutWages(db, garage)).toBe(s.wagePerRound);
    playPrelims(db, 1);
    playFinal(db, 1);
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`));
    settleRound(db, 1);
    const wages = -Number(
      scalar(
        db,
        `SELECT SUM(amount) FROM ledger WHERE garage_id = ${garage} AND round_id = 1 AND category = 'wages'`,
      ),
    );
    expect(wages).toBe(s.wagePerRound);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`))).toBeLessThan(cash);
  });
});

describe('the Head of Scouting’s tips', () => {
  const withHead = (seed: string): { db: Database; garage: number } => {
    const c = newCareer(seed);
    c.db.run(
      `INSERT INTO executive (garage_id, role, name, birth_year, skill, status, salary, start_year, end_year, hired_on)
       VALUES (?, 'head_of_scouting', 'Test Head', 1990, 80, 'employed', 0, 2031, 2034, '2031-02-01')`,
      [c.garage],
    );
    return c;
  };

  /** A young driver in a rival garage, with a top potential and the given final places over rounds 1 to 4. */
  const prospect = (db: Database, garage: number, places: number[]): number => {
    const entry = db.exec(
      `SELECT id, driver_id FROM entry WHERE garage_id <> ${garage} ORDER BY id LIMIT 1`,
    )[0]!.values[0]!;
    db.run('UPDATE driver SET birth_date = ?, potential = 100 WHERE id = ?', [
      '2012-05-01',
      entry[1]!,
    ]);
    places.forEach((place, i) =>
      db.run('INSERT INTO result (round_id, entry_id, final_pos) VALUES (?, ?, ?)', [
        i + 1,
        entry[0]!,
        place,
      ]),
    );
    return Number(entry[1]);
  };

  it('are empty without a Head of Scouting', () => {
    const { db, garage } = newCareer('tips-none');
    prospect(db, garage, [20, 20, 3, 3]);
    expect(risingDrivers(db, garage)).toEqual([]);
  });

  it('are empty while no driver has finals to compare', () => {
    const { db, garage } = withHead('tips-fresh');
    expect(risingDrivers(db, garage)).toEqual([]);
  });

  it('name a young rival driver whose places are improving, with the public places and a reading', () => {
    const { db, garage } = withHead('tips-rising');
    const driver = prospect(db, garage, [20, 20, 3, 3]);
    const tips = risingDrivers(db, garage);
    expect(tips.length).toBeLessThanOrEqual(scoutingBalance.tips.max);
    const tip = tips.find((t) => t.driverId === driver)!;
    expect(tip).toBeDefined();
    expect(tip).toMatchObject({ age: 19, earlierPlace: 20, recentPlace: 3 });
    expect(readingMidpoint(tip.potential)).toBeGreaterThanOrEqual(
      scoutingBalance.tips.minPotential,
    );
    // Nothing of the true potential (100) is carried beyond the reading the player has.
    expect(Object.keys(tip).sort()).toEqual(
      ['age', 'driverId', 'earlierPlace', 'knowledge', 'name', 'potential', 'recentPlace'].sort(),
    );
  });

  it('pass over a driver whose places are slipping, who is not young, or who is the garage’s own', () => {
    const slipping = withHead('tips-slipping');
    prospect(slipping.db, slipping.garage, [3, 3, 20, 20]);
    expect(risingDrivers(slipping.db, slipping.garage)).toEqual([]);

    const old = withHead('tips-old');
    const driver = prospect(old.db, old.garage, [20, 20, 3, 3]);
    old.db.run("UPDATE driver SET birth_date = '1990-01-01' WHERE id = ?", [driver]);
    expect(risingDrivers(old.db, old.garage)).toEqual([]);

    const own = withHead('tips-own');
    const mine = own.db.exec(
      `SELECT id, driver_id FROM entry WHERE garage_id = ${own.garage} ORDER BY id LIMIT 1`,
    )[0]!.values[0]!;
    own.db.run('UPDATE driver SET birth_date = ?, potential = 100 WHERE id = ?', [
      '2012-05-01',
      mine[1]!,
    ]);
    [20, 20, 3, 3].forEach((p, i) =>
      own.db.run('INSERT INTO result (round_id, entry_id, final_pos) VALUES (?, ?, ?)', [
        i + 1,
        mine[0]!,
        p,
      ]),
    );
    expect(risingDrivers(own.db, own.garage).map((t) => t.driverId)).not.toContain(Number(mine[1]));
  });

  it('are the same every time they are asked for', () => {
    const { db, garage } = withHead('tips-same');
    prospect(db, garage, [20, 20, 3, 3]);
    expect(risingDrivers(db, garage)).toEqual(risingDrivers(db, garage));
  });
});
