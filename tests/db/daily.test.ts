// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { bringForwardTo, moveDateTo } from '../../src/db/calendar';
import { createCareer } from '../../src/db/career';
import { dailyLifeView, moveDriver } from '../../src/db/daily';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { isDailyLifeDay, roadTypeOfPlace } from '../../src/sim/daily';
import { addDays } from '../../src/sim/worldgen/calendar';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Daily Life Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function fresh(seed: string): { db: Database; garageId: number } {
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

/** Plays a round the way the calendar does: the date moves to the prelims, then the final, each day of daily life on the way. */
const playRound = (db: Database, n: number) => {
  bringForwardTo(db, 'prelims', n);
  playPrelims(db, n);
  bringForwardTo(db, 'final', n);
  playFinal(db, n);
  settleRound(db, n);
};

/** The days of daily life up to a date, counted from the rounds in the database. */
const lifeDays = (db: Database, upTo: string): number => {
  const rounds = db
    .exec('SELECT practice_start, final_date FROM round ORDER BY number')[0]!
    .values.map((r) => ({ practiceStart: r[0] as string, finalDate: r[1] as string }));
  let n = 0;
  for (let d = addDays('2031-02-01', 1); d <= upTo; d = addDays(d, 1))
    if (isDailyLifeDay(d, '2031-02-01', rounds)) n++;
  return n;
};

describe('daily life between rounds', () => {
  it('pays delivery income for each day that passes, per entered car, and only to the player', () => {
    const { db, garageId } = fresh('daily-income');
    const entries = Number(
      scalar(db, `SELECT COUNT(*) FROM entry WHERE garage_id = ${garageId} AND series = 'main'`),
    );
    playRound(db, 1);
    playRound(db, 2);
    const date = String(scalar(db, 'SELECT game_date FROM career'));
    const days = lifeDays(db, date);
    expect(days).toBeGreaterThan(70);
    const paid = Number(
      scalar(
        db,
        `SELECT SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'delivery'`,
      ),
    );
    expect(paid).toBeGreaterThanOrEqual(entries * days * 167 * 0.8);
    expect(paid).toBeLessThanOrEqual(entries * days * 167 * 1.12);
    expect(
      scalar(
        db,
        "SELECT COUNT(*) FROM ledger WHERE category = 'delivery' AND garage_id <> " + garageId,
      ),
    ).toBe(0);
  });

  it('pays the same however the days are skipped', () => {
    const run = (steps: string[]) => {
      const { db, garageId } = fresh('daily-steps');
      for (const to of steps) moveDateTo(db, to);
      return Number(
        scalar(
          db,
          `SELECT SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'delivery'`,
        ),
      );
    };
    const once = run(['2031-03-20']);
    const daily: string[] = [];
    for (let d = addDays('2031-02-01', 1); d <= '2031-03-20'; d = addDays(d, 1)) daily.push(d);
    expect(run(daily)).toBe(once);
    expect(once).toBeGreaterThan(0);
  });

  it('puts the road kilometres on the car, wears it, and leaves computer garages alone', () => {
    const { db, garageId } = fresh('daily-wear');
    const player = db.exec(
      `SELECT c.id, c.road_km, c.wear FROM entry e JOIN car c ON c.id = e.car_id
        WHERE e.garage_id = ${garageId} AND e.series = 'main' ORDER BY e.id LIMIT 1`,
    )[0]!.values[0]! as number[];
    const others = Number(
      scalar(
        db,
        `SELECT SUM(c.road_km) FROM entry e JOIN car c ON c.id = e.car_id WHERE e.garage_id <> ${garageId} AND e.series = 'main'`,
      ),
    );
    playRound(db, 1);
    playRound(db, 2);
    const after = db.exec(`SELECT road_km, race_km, wear FROM car WHERE id = ${player[0]}`)[0]!
      .values[0]! as number[];
    const date = String(scalar(db, 'SELECT game_date FROM career'));
    expect(after[0]! - player[1]!).toBe(lifeDays(db, date) * 40);
    expect(after[2]!).toBeGreaterThan(player[2]!);
    expect(
      Number(
        scalar(
          db,
          `SELECT SUM(c.road_km) FROM entry e JOIN car c ON c.id = e.car_id WHERE e.garage_id <> ${garageId} AND e.series = 'main'`,
        ),
      ),
    ).toBe(others);
  });

  it('slowly trains the driver on the roads around their home, up to a cap', () => {
    const { db, garageId } = fresh('daily-affinity');
    const driver = db.exec(
      `SELECT d.id, p.stable_id FROM entry e JOIN driver d ON d.id = e.driver_id JOIN place p ON p.id = d.residence_place_id
        WHERE e.garage_id = ${garageId} AND e.series = 'main' ORDER BY e.id LIMIT 1`,
    )[0]!.values[0]! as [number, string];
    const type = roadTypeOfPlace({ id: driver[1] });
    const rating = () =>
      Number(
        scalar(
          db,
          `SELECT rating FROM driver_road_affinity WHERE driver_id = ${driver[0]} AND road_type = '${type}'`,
        ),
      );
    const before = rating();
    playRound(db, 1);
    playRound(db, 2);
    if (before < 70) expect(rating()).toBeGreaterThan(before);
    expect(rating()).toBeLessThanOrEqual(Math.max(before, 70));
    // A driver already above the cap keeps their rating.
    db.run(
      `UPDATE driver_road_affinity SET rating = 85 WHERE driver_id = ${driver[0]} AND road_type = '${type}'`,
    );
    playRound(db, 3);
    expect(rating()).toBe(85);
  });

  it('shows where the drivers live, and the next round’s deliveries', () => {
    const { db, garageId } = fresh('daily-view');
    const view = dailyLifeView(db, garageId);
    expect(view.drivers.length).toBeGreaterThan(0);
    expect(view.drivers[0]!.residence).toMatch(/, /);
    expect(view.canMove).toBe(false);
    expect(view.nextGap).toMatchObject({ round: 1, days: 57 });
    expect(view.nextGap!.income).toBeGreaterThan(0);
  });
});

describe('moving home in the off-season', () => {
  let db: Database;
  let garageId: number;
  let driverId: number;
  beforeAll(() => {
    ({ db, garageId } = fresh('daily-move'));
    driverId = Number(
      scalar(
        db,
        `SELECT driver_id FROM entry WHERE garage_id = ${garageId} AND series = 'main' LIMIT 1`,
      ),
    );
    for (let n = 1; n <= 6; n++) playRound(db, n);
  }, 180_000);

  it('cannot be booked while the season is still running', () => {
    expect(() => moveDriver(db, garageId, driverId, 'au-hobart')).toThrow(/off-season/);
  });

  it('costs $5,000, can be changed for free, and waits for the next season', () => {
    endSeason(db);
    expect(dailyLifeView(db, garageId).canMove).toBe(true);
    const cash = () => Number(scalar(db, `SELECT cash FROM garage WHERE id = ${garageId}`));
    const home = () =>
      String(
        scalar(
          db,
          `SELECT p.stable_id FROM driver d JOIN place p ON p.id = d.residence_place_id WHERE d.id = ${driverId}`,
        ),
      );
    const before = cash();
    const old = home();
    const target = old === 'au-hobart' ? 'au-darwin' : 'au-hobart';
    moveDriver(db, garageId, driverId, target);
    expect(cash()).toBe(before - 5000);
    expect(home()).toBe(old);
    expect(
      dailyLifeView(db, garageId).drivers.find((d) => d.driverId === driverId)!.movingTo,
    ).not.toBeNull();
    // Choosing somewhere else replaces the booking without paying again.
    const other = target === 'au-darwin' ? 'au-perth' : 'au-darwin';
    moveDriver(db, garageId, driverId, other);
    expect(cash()).toBe(before - 5000);
    startNextSeason(db);
    expect(home()).toBe(other);
    expect(scalar(db, 'SELECT COUNT(*) FROM driver_move')).toBe(0);
    expect(
      Number(
        scalar(
          db,
          `SELECT -SUM(amount) FROM ledger WHERE garage_id = ${garageId} AND category = 'relocation'`,
        ),
      ),
    ).toBe(5000);
  }, 180_000);

  it('refuses a driver the garage did not enter, an unknown place, a move to where they already live, and one it cannot afford', () => {
    const stranger = Number(
      scalar(
        db,
        `SELECT driver_id FROM entry WHERE garage_id <> ${garageId} AND series = 'main' LIMIT 1`,
      ),
    );
    // A new season has started, so the off-season is over: bring a finished season back to test the rest.
    const fresh2 = fresh('daily-move-rules');
    for (let n = 1; n <= 6; n++) playRound(fresh2.db, n);
    endSeason(fresh2.db);
    const d = Number(
      scalar(
        fresh2.db,
        `SELECT driver_id FROM entry WHERE garage_id = ${fresh2.garageId} AND series = 'main' LIMIT 1`,
      ),
    );
    expect(() => moveDriver(fresh2.db, fresh2.garageId, stranger, 'au-hobart')).toThrow(
      /did not enter/,
    );
    expect(() => moveDriver(fresh2.db, fresh2.garageId, d, 'nowhere')).toThrow(/no place/);
    const here = String(
      scalar(
        fresh2.db,
        `SELECT p.stable_id FROM driver d JOIN place p ON p.id = d.residence_place_id WHERE d.id = ${d}`,
      ),
    );
    expect(() => moveDriver(fresh2.db, fresh2.garageId, d, here)).toThrow(/already lives/);
    fresh2.db.run(`UPDATE garage SET cash = 100 WHERE id = ${fresh2.garageId}`);
    const elsewhere = here === 'au-hobart' ? 'au-darwin' : 'au-hobart';
    expect(() => moveDriver(fresh2.db, fresh2.garageId, d, elsewhere)).toThrow(/cannot afford/);
  }, 180_000);
});
