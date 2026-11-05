// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

describe('fans from a round', () => {
  let db: Database;
  const driversBefore = new Map<number, number>();
  let garageBefore = new Map<number, number>();
  let flagsBefore = new Map<string, number>();
  beforeAll(() => {
    db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'fans-round',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('fans-round'));
    playPrelims(db, 1);
    for (const [id, fans] of db.exec('SELECT id, fans FROM driver')[0]!.values as [
      number,
      number,
    ][])
      driversBefore.set(id, fans);
    garageBefore = new Map(
      (db.exec('SELECT id, fans FROM garage')[0]!.values as [number, number][]).map((v) => [
        v[0],
        v[1],
      ]),
    );
    flagsBefore = new Map(
      (db.exec('SELECT flag, fans FROM flag_fans')[0]!.values as [string, number][]).map((v) => [
        v[0],
        v[1],
      ]),
    );
    playFinal(db, 1);
  }, 120_000);

  it('gives the winner at least a hundredth of the audience, and the garage and car their shares', () => {
    const winner = db.exec(
      `SELECT e.driver_id, e.garage_id, e.car_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.final_pos = 1`,
    )[0]!.values[0] as number[];
    const [driverId, garageId, carId] = winner as [number, number, number];
    const audience = Number(scalar(db, 'SELECT series_fans FROM season'));
    const gain =
      Number(scalar(db, `SELECT fans FROM driver WHERE id = ${driverId}`)) -
      driversBefore.get(driverId)!;
    expect(gain).toBeGreaterThanOrEqual(Math.round(audience * 0.01));
    expect(
      Number(scalar(db, `SELECT fans FROM garage WHERE id = ${garageId}`)) -
        garageBefore.get(garageId)!,
    ).toBeGreaterThan(0);
    expect(Number(scalar(db, `SELECT fans FROM car WHERE id = ${carId}`))).toBeGreaterThan(0);
  });

  it('moves a driver’s fame with their fans', () => {
    const fame = db.exec('SELECT fans, fame FROM driver WHERE fans > 1000 LIMIT 20')[0]!.values as [
      number,
      number,
    ][];
    expect(fame.length).toBeGreaterThan(0);
    for (const [fans, f] of fame)
      expect(Math.abs(f - 12.5 * Math.log10(fans / 10))).toBeLessThanOrEqual(1);
  });

  it('adds to the flags, keeps the United Kingdom equal to its home nations, and never shrinks one', () => {
    let grew = 0;
    for (const [flag, fans] of db.exec('SELECT flag, fans FROM flag_fans')[0]!.values as [
      string,
      number,
    ][]) {
      expect(fans).toBeGreaterThanOrEqual(flagsBefore.get(flag) ?? 0);
      if (fans > (flagsBefore.get(flag) ?? 0)) grew += 1;
    }
    expect(grew).toBeGreaterThan(3);
    const parts = Number(
      scalar(
        db,
        "SELECT SUM(fans) FROM flag_fans WHERE flag IN ('gb-eng','gb-sct','gb-wls','gb-nir')",
      ),
    );
    const gb = Number(scalar(db, "SELECT fans FROM flag_fans WHERE flag = 'GB'"));
    expect(Math.abs(gb - parts)).toBeLessThanOrEqual(parts * 0.05 + 10);
  });

  it('never takes anyone over 40% of the audience', () => {
    const audience = Number(scalar(db, 'SELECT series_fans FROM season'));
    expect(Number(scalar(db, 'SELECT MAX(fans) FROM driver'))).toBeLessThanOrEqual(
      Math.round(audience * 0.4),
    );
  });
});
