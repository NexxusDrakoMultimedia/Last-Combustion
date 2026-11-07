// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { partConditions, wearParts } from '../../src/db/repairs';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import {
  fireMechanic,
  garageCrewStrength,
  garageStaff,
  hireMechanic,
  mechanicCandidates,
  roundWages,
} from '../../src/db/staff';
import { fitPart } from '../../src/db/upgrades';
import { persistWorld } from '../../src/db/world';
import { staffBalance } from '../../src/sim/worldgen/data';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'staff-db'): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  db.run('UPDATE garage SET cash = 100000000');
  return db;
}

const firstEntry = (db: Database) =>
  db.exec('SELECT car_id, garage_id FROM entry ORDER BY id LIMIT 1')[0]!.values[0] as [
    number,
    number,
  ];

describe('the job market for mechanics', () => {
  it('puts someone let go back on offer, as the same person, until they retire', () => {
    const db = newCareer('staff-market');
    const [, garage] = firstEntry(db);
    const hired = hireMechanic(db, garage, 0);
    fireMechanic(db, garage, hired.id);
    expect(scalar(db, `SELECT left_reason FROM staff WHERE id = ${hired.id}`)).toBe('fired');
    const offers = mechanicCandidates(db, garage);
    const again = offers.findIndex((o) => o.staffId === hired.id);
    expect(again).toBeGreaterThanOrEqual(0);
    const rehired = hireMechanic(db, garage, again);
    // The same row, back at work, with nothing left against it.
    expect(rehired.id).toBe(hired.id);
    expect(scalar(db, `SELECT left_on FROM staff WHERE id = ${hired.id}`)).toBeNull();
    expect(scalar(db, `SELECT left_reason FROM staff WHERE id = ${hired.id}`)).toBeNull();
    expect(scalar(db, 'SELECT COUNT(*) FROM staff')).toBe(1);
    // Let go again and kept out of work for two full seasons: they have retired and are not offered.
    fireMechanic(db, garage, hired.id);
    db.run("UPDATE career SET game_date = '2034-02-01'");
    expect(mechanicCandidates(db, garage).some((o) => o.staffId === hired.id)).toBe(false);
  });

  it('never offers someone who retired or died', () => {
    const db = newCareer('staff-market-final');
    const [, garage] = firstEntry(db);
    const a = hireMechanic(db, garage, 0);
    fireMechanic(db, garage, a.id);
    db.run("UPDATE staff SET left_reason = 'died' WHERE id = ?", [a.id]);
    expect(mechanicCandidates(db, garage).some((o) => o.staffId === a.id)).toBe(false);
  });
});

describe('hiring and letting go', () => {
  it('starts with no mechanics, offers four, and keeps the same offers until someone is hired', () => {
    const db = newCareer();
    const [, garage] = firstEntry(db);
    expect(garageStaff(db, garage)).toEqual([]);
    expect(garageCrewStrength(db, garage)).toBe(0);
    const offers = mechanicCandidates(db, garage);
    expect(offers).toHaveLength(4);
    expect(mechanicCandidates(db, garage)).toEqual(offers);
    const hired = hireMechanic(db, garage, 1);
    expect(hired.name).toBe(offers[1]!.name);
    expect(hired.skill).toBe(offers[1]!.skill);
    expect(hired.wagePerWeek).toBe(offers[1]!.wagePerWeek);
    expect(JSON.stringify(mechanicCandidates(db, garage))).not.toBe(JSON.stringify(offers));
    expect(garageCrewStrength(db, garage)).toBeGreaterThan(0);
  });

  it('refuses an offer that does not exist, and a crew bigger than the limit', () => {
    const db = newCareer('staff-limit');
    const [, garage] = firstEntry(db);
    expect(() => hireMechanic(db, garage, 9)).toThrow(/no such mechanic/);
    const cap = staffBalance.maxPerGarage;
    for (let i = 0; i < cap; i++) hireMechanic(db, garage, 0);
    expect(() => hireMechanic(db, garage, 0)).toThrow(/at most/);
  });

  it('charges a round’s wages as notice when a mechanic goes, and not for a stranger', () => {
    const db = newCareer('staff-fire');
    const [, garage] = firstEntry(db);
    const m = hireMechanic(db, garage, 0);
    const before = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`));
    expect(fireMechanic(db, garage, m.id)).toBe(m.wagePerRound);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garage}`))).toBe(
      before - m.wagePerRound,
    );
    expect(garageStaff(db, garage)).toEqual([]);
    expect(() => fireMechanic(db, garage, m.id)).toThrow(/does not employ/);
    expect(
      Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM ledger WHERE garage_id = ${garage} AND category = 'wages'`,
        ),
      ),
    ).toBe(1);
  });
});

describe('what a crew does', () => {
  it('is paid for each round when it is settled', () => {
    const db = newCareer('staff-wages');
    const [, garage] = firstEntry(db);
    const a = hireMechanic(db, garage, 0);
    const b = hireMechanic(db, garage, 0);
    expect(roundWages(db, garage)).toBe(a.wagePerRound + b.wagePerRound);
    playPrelims(db, 1);
    playFinal(db, 1);
    settleRound(db, 1);
    expect(
      Number(
        scalar(
          db,
          `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garage} AND category = 'wages' AND round_id IS NOT NULL`,
        ),
      ),
    ).toBe(a.wagePerRound + b.wagePerRound);
    // A garage with no mechanics pays no wages.
    const other = Number(
      scalar(db, `SELECT garage_id FROM entry WHERE garage_id <> ${garage} LIMIT 1`),
    );
    expect(
      Number(
        scalar(db, `SELECT COUNT(*) FROM ledger WHERE garage_id = ${other} AND category = 'wages'`),
      ),
    ).toBe(0);
  });

  it('wears the parts of its cars more slowly', () => {
    const wear = (crewed: boolean) => {
      const db = newCareer('staff-wear');
      const [carId, garage] = firstEntry(db);
      fitPart(db, garage, carId, 'engine-sport');
      if (crewed) for (let i = 0; i < 4; i++) hireMechanic(db, garage, 0);
      wearParts(db, carId, 5000, 'race', 'mid');
      return partConditions(db, carId)[0]!.wear;
    };
    expect(wear(true)).toBeLessThan(wear(false));
  });

  it('shrinks the bill for crash repairs', () => {
    const repairs = (crewed: boolean) => {
      const db = newCareer('staff-repairs');
      const [, garage] = firstEntry(db);
      if (crewed) for (let i = 0; i < 4; i++) hireMechanic(db, garage, 0);
      playPrelims(db, 1);
      const entry = db.exec(
        `SELECT e.id FROM entry e WHERE e.garage_id = ${garage} AND e.series = 'main' LIMIT 1`,
      )[0]!.values[0]![0] as number;
      db.run("UPDATE result SET dnf_reason = 'crash' WHERE entry_id = ?", [entry]);
      settleRound(db, 1);
      return Number(
        scalar(
          db,
          `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garage} AND category = 'repairs'`,
        ),
      );
    };
    expect(repairs(true)).toBeLessThan(repairs(false));
    expect(repairs(false)).toBeGreaterThan(0);
  });
});
