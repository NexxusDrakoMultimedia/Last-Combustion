// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { freeAgents, salaryHint } from '../../src/db/freeagents';
import { DRIVER_STATS, readDriverById, readSeriesGarages } from '../../src/db/knowledge';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { driverProfile } from '../../src/db/registry';
import { assignScout, hireScout } from '../../src/db/scouts';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import type { Reading } from '../../src/sim/scouting';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Garage Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(seed = 'fog-drivers'): { db: Database; garageId: number } {
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
  db.run('UPDATE garage SET cash = 100000000 WHERE id = ?', [garageId]);
  return { db, garageId };
}

const ownDriver = (db: Database, garageId: number): number =>
  Number(
    db.exec(`SELECT driver_id FROM entry WHERE garage_id = ${garageId} LIMIT 1`)[0]!.values[0]![0],
  );

const truth = (db: Database, id: number, column: string): number =>
  Number(db.exec(`SELECT ${column} FROM driver WHERE id = ${id}`)[0]!.values[0]![0]);
const COLUMN: Record<string, string> = {
  pace: 'pace',
  consistency: 'consistency',
  racecraft: 'racecraft',
  tyreManagement: 'tyre_management',
  composure: 'composure',
  wetSkill: 'wet_skill',
};
const holds = (r: Reading, value: number): boolean =>
  r.kind === 'range' ? r.low <= value && value <= r.high : r.kind === 'exact' && r.value === value;
const width = (r: Reading): number =>
  r.kind === 'range' ? r.high - r.low : r.kind === 'exact' ? 0 : 100;

describe('what the player reads of a driver', () => {
  it('shows the player’s own driver exactly', () => {
    const { db, garageId } = fresh();
    const own = ownDriver(db, garageId);
    const reading = readDriverById(db, own);
    expect(reading.owned).toBe(true);
    expect(reading.potential).toEqual({ kind: 'exact', value: truth(db, own, 'potential') });
    for (const k of DRIVER_STATS)
      expect(reading.stats[k]).toEqual({ kind: 'exact', value: truth(db, own, COLUMN[k]!) });
  });

  it('hides a driver the player does not own, but never lies about them', () => {
    const { db, garageId } = fresh();
    const agents = freeAgents(db, garageId);
    expect(agents.length).toBeGreaterThanOrEqual(5);
    for (const a of agents) {
      expect(a.reading.owned).toBe(false);
      for (const k of DRIVER_STATS) {
        const r = a.reading.stats[k];
        expect(r.kind).not.toBe('exact');
        if (r.kind === 'range') expect(holds(r, truth(db, a.driverId, COLUMN[k]!))).toBe(true);
      }
      const p = a.reading.potential;
      if (p.kind === 'range') expect(holds(p, truth(db, a.driverId, 'potential'))).toBe(true);
    }
  });

  it('gives the same reading every time, and on a reload', () => {
    const { db, garageId } = fresh('fog-stable');
    const first = freeAgents(db, garageId).map((a) => a.reading);
    expect(freeAgents(db, garageId).map((a) => a.reading)).toEqual(first);
  });

  it('is clearer with a scout assigned, and the range only tightens', () => {
    const { db, garageId } = fresh('fog-scout');
    const target = freeAgents(db, garageId)[0]!;
    const before = readDriverById(db, target.driverId);
    const scout = hireScout(db, garageId, 0, 'drivers');
    const general = readDriverById(db, target.driverId);
    assignScout(db, garageId, scout.id, { kind: 'drivers', id: target.driverId });
    const assigned = readDriverById(db, target.driverId);
    expect(general.knowledge).toBeGreaterThanOrEqual(before.knowledge);
    expect(assigned.knowledge).toBeGreaterThan(general.knowledge);
    for (const k of DRIVER_STATS) {
      expect(width(assigned.stats[k])).toBeLessThanOrEqual(width(before.stats[k]));
      const a = assigned.stats[k];
      if (a.kind === 'range') expect(holds(a, truth(db, target.driverId, COLUMN[k]!))).toBe(true);
    }
  });

  it('reaches the Registry page, exact for the own driver and fogged for others', () => {
    const { db, garageId } = fresh('fog-registry');
    const own = ownDriver(db, garageId);
    expect(driverProfile(db, own).skills.owned).toBe(true);
    const other = freeAgents(db, garageId)[0]!.driverId;
    const skills = driverProfile(db, other).skills;
    expect(skills.owned).toBe(false);
    expect(skills.potential.kind).not.toBe('exact');
  });

  it('shows everything exactly before there is a garage to learn for', () => {
    const db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'fog-none',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('fog-none'));
    const id = Number(db.exec('SELECT id FROM driver ORDER BY id LIMIT 1')[0]!.values[0]![0]);
    const reading = readDriverById(db, id);
    expect(reading.stats.pace.kind).toBe('exact');
  });
});

describe('the salary hint', () => {
  it('follows the rating reading: the band’s range for a word, a range, or one amount when exact', () => {
    const word = salaryHint({ kind: 'word', band: 'solid' }, false);
    expect(word.low).toBeLessThan(word.high);
    // The wider the word, the wider the hint: a deal and a driver both open with at least a range.
    const bands = ['weak', 'modest', 'solid', 'strong', 'elite'].map((band) =>
      salaryHint({ kind: 'word', band }, false),
    );
    for (let i = 1; i < bands.length; i++)
      expect(bands[i]!.low).toBeGreaterThanOrEqual(bands[i - 1]!.low);
    const exact = salaryHint({ kind: 'exact', value: 60 }, false);
    expect(exact.low).toBe(exact.high);
    const range = salaryHint({ kind: 'range', low: 50, high: 70, band: 'solid' }, false);
    expect(range.low).toBeLessThan(range.high);
    expect(range.high).toBeGreaterThan(exact.low);
  });
});

describe('the series totals', () => {
  it('read the average prestige and total cash through the fog, and hold the truth', () => {
    const { db } = fresh('fog-series');
    const series = readSeriesGarages(db);
    const rows = db.exec("SELECT prestige, cash FROM garage WHERE kind = 'racing'")[0]!.values;
    const cash = rows.reduce((a, r) => a + Number(r[1]), 0);
    const average = rows.reduce((a, r) => a + Number(r[0]), 0) / rows.length;
    expect(series.totalCash.low).toBeLessThanOrEqual(cash);
    expect(series.totalCash.high).toBeGreaterThanOrEqual(cash);
    expect(series.totalCash.low).toBeLessThan(series.totalCash.high);
    const reading = series.averagePrestige;
    if (reading.kind === 'range') {
      expect(reading.low).toBeLessThanOrEqual(Math.round(average));
      expect(reading.high).toBeGreaterThanOrEqual(Math.round(average));
    }
  });
});

describe('the signed drivers on the Drivers panel', () => {
  it('always show, first, however low the player reads them, so none can be signed and then lost', () => {
    const { db, garageId } = fresh('signed-visible');
    // A year or two on there are many drivers without a seat: free sixty of them here.
    db.run(
      'DELETE FROM entry WHERE id IN (SELECT id FROM entry WHERE garage_id <> ? ORDER BY id LIMIT 60)',
      [garageId],
    );
    const everyone = freeAgents(db, garageId, 10_000);
    expect(everyone.length).toBeGreaterThan(30);
    // Four of the worst-reading drivers, far outside the best 25.
    const worst = everyone.slice(-4);
    for (const d of worst) {
      db.run(
        `INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee, garage_prize_share)
         VALUES (?, ?, 2031, 2032, 30000, 'development', 0, 0.8)`,
        [d.driverId, garageId],
      );
    }
    const shown = freeAgents(db, garageId);
    for (const d of worst) expect(shown.find((a) => a.driverId === d.driverId)?.signed).toBe(true);
    // They come first, then the best of the rest.
    expect(shown.slice(0, 4).every((a) => a.signed)).toBe(true);
    expect(shown.filter((a) => !a.signed)).toHaveLength(25);
  });
});
