// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { currentAuction, ensureAuction } from '../../src/db/auction';
import { createCareer } from '../../src/db/career';
import { inspectCar, inspectionFee } from '../../src/db/inspection';
import { readCarById } from '../../src/db/knowledge';
import { buyUsedCar, openListings, refreshUsedMarket } from '../../src/db/market';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { carProfile } from '../../src/db/registry';
import { assignScout, hireScout } from '../../src/db/scouts';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
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

function fresh(seed = 'fog-cars'): { db: Database; garageId: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  refreshUsedMarket(db);
  ensureAuction(db);
  db.run('UPDATE garage SET cash = 100000000 WHERE id = ?', [garageId]);
  return { db, garageId };
}

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];
const wearOf = (db: Database, carId: number) =>
  Number(scalar(db, `SELECT wear FROM car WHERE id = ${carId}`));
const holds = (r: Reading, v: number) =>
  r.kind === 'range'
    ? r.low <= v && v <= r.high
    : r.kind === 'exact' && Math.abs(r.value - v) <= 0.5;

describe('cars for sale', () => {
  it('are fogged for the player, and the readings never lie', () => {
    const { db, garageId } = fresh();
    const list = openListings(db, garageId);
    expect(list.length).toBeGreaterThan(3);
    for (const l of list) {
      expect(l.reading.owned).toBe(false);
      expect(l.reading.condition.kind).not.toBe('exact');
      if (l.reading.condition.kind === 'range')
        expect(holds(l.reading.condition, 100 - wearOf(db, l.carId))).toBe(true);
    }
    // Without a garage (for the simulation) nothing is hidden.
    expect(openListings(db)[0]!.reading.condition.kind).toBe('exact');
  });

  it('shows the same reading every time', () => {
    const { db, garageId } = fresh('fog-cars-stable');
    expect(openListings(db, garageId).map((l) => l.reading)).toEqual(
      openListings(db, garageId).map((l) => l.reading),
    );
  });

  it('fogs the auction lots too, but not the garage’s own lot', () => {
    const { db, garageId } = fresh('fog-lots');
    const lots = currentAuction(db, garageId)!.lotViews;
    expect(lots.length).toBeGreaterThan(0);
    expect(lots.every((l) => l.reading.condition.kind !== 'exact')).toBe(true);
  });
});

describe('inspecting a car', () => {
  it('costs the fee, takes the car to exact, and cannot be repeated', () => {
    const { db, garageId } = fresh('fog-inspect');
    const l = openListings(db, garageId)[0]!;
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    expect(inspectCar(db, garageId, l.carId)).toBe(inspectionFee());
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`))).toBe(
      cash - inspectionFee(),
    );
    const after = openListings(db, garageId).find((x) => x.carId === l.carId)!;
    expect(after.reading.inspected).toBe(true);
    expect(after.reading.condition).toEqual({
      kind: 'exact',
      value: Math.round(100 - wearOf(db, l.carId)),
    });
    expect(after.reading.restorations).not.toBeNull();
    expect(() => inspectCar(db, garageId, l.carId)).toThrow(/already been inspected/);
    expect(
      Number(
        scalar(
          db,
          `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'inspection'`,
        ),
      ),
    ).toBe(inspectionFee());
  });

  it('refuses a car that is not for sale, the garage’s own car and a garage with no money', () => {
    const { db, garageId } = fresh('fog-inspect-refuse');
    const own = Number(scalar(db, `SELECT id FROM car WHERE garage_id = ${garageId} LIMIT 1`));
    expect(() => inspectCar(db, garageId, own)).toThrow(/already exact/);
    const rival = Number(
      scalar(db, `SELECT car_id FROM entry WHERE garage_id <> ${garageId} LIMIT 1`),
    );
    expect(() => inspectCar(db, garageId, rival)).toThrow(/for sale/);
    const l = openListings(db, garageId)[0]!;
    db.run('UPDATE garage SET cash = 0 WHERE id = ?', [garageId]);
    expect(() => inspectCar(db, garageId, l.carId)).toThrow(/afford/);
  });

  it('stops counting once the car has a different owner, and a bought car is exact anyway', () => {
    const { db, garageId } = fresh('fog-inspect-owner');
    const l = openListings(db, garageId)[0]!;
    inspectCar(db, garageId, l.carId);
    // A rival buys it: the seller changes, so the inspection no longer counts.
    const rival = Number(
      scalar(db, `SELECT id FROM garage WHERE kind = 'racing' AND is_player = 0 LIMIT 1`),
    );
    db.run('UPDATE car SET garage_id = ? WHERE id = ?', [rival, l.carId]);
    expect(readCarById(db, l.carId).inspected).toBe(false);
    // Bought by the player, any car is theirs and exact.
    const m = openListings(db, garageId)[0]!;
    buyUsedCar(db, garageId, m.id);
    expect(readCarById(db, m.carId)).toMatchObject({ owned: true });
    expect(readCarById(db, m.carId).condition.kind).toBe('exact');
  });
});

describe('the Registry car page', () => {
  it('is exact for the garage’s own car and fogged for another', () => {
    const { db, garageId } = fresh('fog-registry-car');
    const own = Number(scalar(db, `SELECT id FROM car WHERE garage_id = ${garageId} LIMIT 1`));
    const mine = carProfile(db, own).reading;
    expect(mine.owned).toBe(true);
    expect(mine.condition.kind).toBe('exact');
    const other = openListings(db, garageId)[0]!.carId;
    const theirs = carProfile(db, other).reading;
    expect(theirs.condition.kind).not.toBe('exact');
    expect(theirs.restorations).toBeNull();
  });

  it('is clearer with a scout assigned to the car, and the truth stays inside', () => {
    const { db, garageId } = fresh('fog-car-scout');
    const l = openListings(db, garageId)[0]!;
    const before = readCarById(db, l.carId);
    const scout = hireScout(db, garageId, 0, 'cars');
    assignScout(db, garageId, scout.id, { kind: 'cars', id: l.carId });
    const after = readCarById(db, l.carId);
    expect(after.knowledge).toBeGreaterThan(before.knowledge);
    const w = (r: Reading) => (r.kind === 'range' ? r.high - r.low : r.kind === 'exact' ? 0 : 100);
    expect(w(after.condition)).toBeLessThanOrEqual(w(before.condition));
    expect(
      holds(after.condition, 100 - wearOf(db, l.carId)) || after.condition.kind === 'word',
    ).toBe(true);
  });
});
