// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { knowledgeContext, readGarageById } from '../../src/db/knowledge';
import { transferCar } from '../../src/db/market';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { scoutingBalance } from '../../src/sim/worldgen/data';
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

function fresh(seed = 'fog-experience'): {
  db: Database;
  garageId: number;
  rival: number;
  car: number;
  year: number;
} {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const garageId = foundPlayerGarage(db, setup);
  const rival = Number(
    db.exec(
      `SELECT id FROM garage WHERE kind = 'racing' AND is_player = 0 AND closed_year IS NULL ORDER BY prestige DESC, id LIMIT 1`,
    )[0]!.values[0]![0],
  );
  const car = Number(
    db.exec(`SELECT id FROM car WHERE garage_id = ${rival} ORDER BY id LIMIT 1`)[0]!.values[0]![0],
  );
  const year = Number(
    String(db.exec('SELECT game_date FROM career')[0]!.values[0]![0]).slice(0, 4),
  );
  return { db, garageId, rival, car, year };
}

const knowledgeOfRival = (db: Database, rival: number): number =>
  readGarageById(db, rival).knowledge;

describe('the experience part of what the player knows of a garage', () => {
  it('is nothing before they have dealt with each other', () => {
    const { db, garageId, rival } = fresh();
    expect(knowledgeContext(db, garageId).garageWorked.has(rival)).toBe(false);
  });

  it('counts a car sold between them', () => {
    const { db, garageId, rival, car, year } = fresh();
    const before = knowledgeOfRival(db, rival);
    db.run(
      "INSERT INTO car_ownership (car_id, garage_id, from_date, price, route) VALUES (?, ?, ?, 1, 'new')",
      [car, rival, `${year - 2}-01-01`],
    );
    transferCar(db, car, garageId, `${year}-03-01`, 1000);
    expect(knowledgeContext(db, garageId).garageWorked.get(rival)).toBe(year);
    expect(knowledgeOfRival(db, rival)).toBe(
      Math.min(100, before + scoutingBalance.experience.year),
    );
  });

  it('counts a car bought from them at auction', () => {
    const { db, garageId, rival, car, year } = fresh();
    db.run(
      "INSERT INTO auction (kind, opens_on, closes_on, status) VALUES ('weekly', ?, ?, 'closed')",
      [`${year - 1}-05-01`, `${year - 1}-05-08`],
    );
    const auction = Number(db.exec('SELECT MAX(id) FROM auction')[0]!.values[0]![0]);
    db.run(
      "INSERT INTO auction_lot (auction_id, car_id, seller_garage_id, reserve, final_price, buyer_garage_id, status) VALUES (?, ?, ?, 1, 2, ?, 'sold')",
      [auction, car, rival, garageId],
    );
    expect(knowledgeContext(db, garageId).garageWorked.get(rival)).toBe(year - 1);
  });

  it('counts a driver who moved from one to the other', () => {
    const { db, garageId, rival, year } = fresh();
    const driver = Number(db.exec('SELECT id FROM driver ORDER BY id LIMIT 1')[0]!.values[0]![0]);
    for (const [g, from, to] of [
      [rival, year - 4, year - 2],
      [garageId, year - 1, year + 1],
    ] as const)
      db.run(
        "INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee) VALUES (?, ?, ?, ?, 1, 'lead', 0)",
        [driver, g, from, to],
      );
    expect(knowledgeContext(db, garageId).garageWorked.get(rival)).toBe(year - 2);
  });

  it('counts shares the owner holds in the garage', () => {
    const { db, garageId, rival, year } = fresh();
    db.run(
      "INSERT INTO shareholding (garage_id, holder_type, holder_id, holder_name, class, shares, paid, since) VALUES (?, 'owner', 1, 'Test Owner', 'ordinary', 1000, 0, ?)",
      [rival, `${year}-01-01`],
    );
    expect(knowledgeContext(db, garageId).garageWorked.get(rival)).toBe(year);
  });

  it('follows the gap in years, whatever it is', () => {
    const { db, garageId, rival, car, year } = fresh('fog-experience-prop');
    const base = knowledgeOfRival(db, rival);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 9 }), (gap) => {
        db.run("DELETE FROM car_ownership WHERE route = 'private'");
        const sold = `${year - gap}-06-01`;
        db.run(
          "INSERT INTO car_ownership (car_id, garage_id, from_date, to_date, price, route) VALUES (?, ?, ?, ?, 1, 'private')",
          [car, rival, `${year - gap - 1}-01-01`, sold],
        );
        db.run(
          "INSERT INTO car_ownership (car_id, garage_id, from_date, price, route) VALUES (?, ?, ?, 1, 'private')",
          [car, garageId, sold],
        );
        const gain =
          gap <= 1
            ? scoutingBalance.experience.year
            : gap <= 3
              ? scoutingBalance.experience.threeYears
              : 0;
        expect(knowledgeOfRival(db, rival)).toBe(Math.min(100, base + gain));
      }),
      { seed: 31396, numRuns: 30 },
    );
  });
});
