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
  roundScoutWages,
  scoutCandidates,
  scoutsForEngine,
} from '../../src/db/scouts';
import { persistWorld } from '../../src/db/world';
import { scoutWageFor } from '../../src/sim/scouting';
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
