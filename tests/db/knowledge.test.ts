// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { freeAgents, salaryHint } from '../../src/db/freeagents';
import { DRIVER_STATS, readDriverById } from '../../src/db/knowledge';
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
  it('follows the rating reading: none for a word, a range, or one amount when exact', () => {
    expect(salaryHint({ kind: 'word', band: 'solid' }, false)).toBeNull();
    const exact = salaryHint({ kind: 'exact', value: 60 }, false)!;
    expect(exact.low).toBe(exact.high);
    const range = salaryHint({ kind: 'range', low: 50, high: 70, band: 'solid' }, false)!;
    expect(range.low).toBeLessThan(range.high);
    expect(range.high).toBeGreaterThan(exact.low);
  });
});
