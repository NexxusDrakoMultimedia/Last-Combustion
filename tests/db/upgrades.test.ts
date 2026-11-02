// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { garageFinance } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { fitPart, fittedParts, legalityOf, removePart, scrutineerCar } from '../../src/db/upgrades';
import { refreshUsedMarket, openListings } from '../../src/db/market';
import { persistWorld } from '../../src/db/world';
import { maxTyreWidthMm, parts } from '../../src/sim/upgrades';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed = 'upgrades-db'): Database {
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

const entryOf = (db: Database, n = 0) =>
  db.exec('SELECT car_id, garage_id FROM entry ORDER BY id')[0]!.values[n] as [number, number];

describe('the catalogue in a career', () => {
  it('is stored with the world', () => {
    const db = newCareer();
    expect(scalar(db, 'SELECT COUNT(*) FROM part')).toBe(parts.length);
    expect(scalar(db, 'SELECT COUNT(*) FROM part_supplier')).toBe(6);
  });
});

describe('fitting a part', () => {
  it('charges the tier price, writes the ledger, and changes the car', () => {
    const db = newCareer();
    const [carId, garageId] = entryOf(db);
    const cash = Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    const kerb = Number(scalar(db, `SELECT kerb_kg_current FROM car WHERE id = ${carId}`));
    const fit = fitPart(db, garageId, carId, 'forced-induction-sport');
    expect(fit.replaced).toBeNull();
    expect(fit.legality).toBe(82);
    expect(Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`))).toBe(
      cash - fit.price,
    );
    expect(garageFinance(db, garageId).byCategory.parts).toBe(-fit.price);
    expect(scalar(db, `SELECT kerb_kg_current FROM car WHERE id = ${carId}`)).toBe(kerb + 30);
    expect(fittedParts(db, carId).map((p) => p.id)).toEqual(['forced-induction-sport']);
    expect(legalityOf(db, carId)).toBe(82);
  });

  it('replaces a part in the same category and keeps one per category', () => {
    const db = newCareer();
    const [carId, garageId] = entryOf(db);
    fitPart(db, garageId, carId, 'engine-street');
    const second = fitPart(db, garageId, carId, 'engine-race');
    expect(second.replaced).toBe('Street engine tune');
    expect(fittedParts(db, carId).map((p) => p.id)).toEqual(['engine-race']);
  });

  it('keeps the Equalizer true after weight reduction (the database enforces it too)', () => {
    const db = newCareer();
    const [carId, garageId] = entryOf(db);
    fitPart(db, garageId, carId, 'weight-reduction-race');
    const kerb = Number(scalar(db, `SELECT kerb_kg_current FROM car WHERE id = ${carId}`));
    const tyre = Number(scalar(db, `SELECT tyre_width_mm FROM car WHERE id = ${carId}`));
    expect(tyre).toBeLessThanOrEqual(maxTyreWidthMm(kerb));
    removePart(db, garageId, carId, 'weight_reduction');
    expect(fittedParts(db, carId)).toEqual([]);
  });

  it('refuses when the garage cannot pay, owns no such car, or the car is for sale', () => {
    const db = newCareer();
    const [carId, garageId] = entryOf(db);
    db.run('UPDATE garage SET cash = 5 WHERE id = ?', [garageId]);
    expect(() => fitPart(db, garageId, carId, 'engine-race')).toThrow(/afford/);
    db.run('UPDATE garage SET cash = 100000000');
    expect(() => fitPart(db, garageId + 1, carId, 'engine-race')).toThrow(/does not own/);
    refreshUsedMarket(db);
    const forSale = openListings(db)[0]!.carId;
    const market = Number(scalar(db, `SELECT garage_id FROM car WHERE id = ${forSale}`));
    expect(() => fitPart(db, market, forSale, 'engine-race')).toThrow(/for sale/);
    expect(() => fitPart(db, garageId, carId, 'nope')).toThrow(/Unknown part/);
    expect(fittedParts(db, carId)).toEqual([]);
  });
});

describe('scrutineering', () => {
  it('passes a stock car and fails a car with too many race parts', () => {
    const db = newCareer();
    const [carId, garageId] = entryOf(db);
    expect(scrutineerCar(db, carId).legal).toBe(true);
    for (const p of parts.filter((x) => x.grade === 'race')) fitPart(db, garageId, carId, p.id);
    expect(legalityOf(db, carId)).toBeLessThan(0);
    expect(scrutineerCar(db, carId)).toEqual({ legal: false, failures: ['legality'] });
  });

  it('disqualifies an illegal car from the prelims, without a time', () => {
    const db = newCareer();
    const [carId, garageId] = entryOf(db);
    for (const p of parts.filter((x) => x.grade === 'race')) fitPart(db, garageId, carId, p.id);
    const summary = playPrelims(db, 1);
    expect(summary.disqualified).toBe(1);
    const row = db.exec(
      `SELECT r.dnf_reason, r.prelim_time_ms, r.prelim_pos FROM result r JOIN entry e ON e.id = r.entry_id WHERE e.car_id = ${carId}`,
    )[0]!.values[0]!;
    expect(row).toEqual(['disqualified', null, null]);
    expect(scalar(db, 'SELECT COUNT(*) FROM result')).toBe(313);
  });

  it('makes a tuned legal car faster in the prelims than the same car stock', () => {
    const timeOf = (tuned: boolean): number => {
      const db = newCareer('tuning');
      const [carId, garageId] = entryOf(db, 5);
      if (tuned) {
        for (const id of ['engine-sport', 'suspension-sport', 'drivetrain-sport', 'aero-sport']) {
          fitPart(db, garageId, carId, id);
        }
        expect(legalityOf(db, carId)).toBeGreaterThanOrEqual(0);
      }
      playPrelims(db, 1);
      return Number(
        scalar(
          db,
          `SELECT r.prelim_time_ms FROM result r JOIN entry e ON e.id = r.entry_id WHERE e.car_id = ${carId}`,
        ),
      );
    };
    expect(timeOf(true)).toBeLessThan(timeOf(false));
  });
});
