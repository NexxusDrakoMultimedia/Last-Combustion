// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { garageBonuses } from '../../src/db/bonuses';
import { createCareer } from '../../src/db/career';
import { ensureBusinesses } from '../../src/db/business';
import { ensureCapTables } from '../../src/db/equity';
import { leaveUnhappy, updateMorale } from '../../src/db/morale';
import { personProfile } from '../../src/db/people';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Morale Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function world(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  foundPlayerGarage(db, setup);
  createStarterOffers(db);
  ensureCapTables(db);
  ensureBusinesses(db, 2031);
  return db;
}

describe('morale in the database', () => {
  it('starts everyone at 50 and moves with the season’s results', () => {
    const db = world('morale-move');
    expect(scalar(db, 'SELECT MIN(morale) FROM executive')).toBe(50);
    const top = Number(scalar(db, 'SELECT garage_id FROM executive ORDER BY garage_id LIMIT 1'));
    updateMorale(db, (id) => ({ rank: id === top ? 1 : 50, of: 50 }));
    const champion = Number(
      scalar(db, `SELECT AVG(morale) FROM executive WHERE garage_id = ${top}`),
    );
    const others = Number(
      scalar(db, `SELECT AVG(morale) FROM executive WHERE garage_id <> ${top}`),
    );
    expect(champion).toBeGreaterThan(others);
    expect(scalar(db, 'SELECT COUNT(*) FROM executive WHERE morale NOT BETWEEN 0 AND 100')).toBe(0);
  });

  it('shows on a person’s profile and nudges what an executive does', () => {
    const db = world('morale-effect');
    const e = db.exec(
      "SELECT id, garage_id FROM executive WHERE status = 'employed' ORDER BY id LIMIT 1",
    )[0]!.values[0]!;
    const profile = personProfile(db, 'executive', e[0] as number);
    expect(profile.kind === 'executive' && profile.morale).toBe(50);
    const before = garageBonuses(db, e[1] as number);
    db.run('UPDATE executive SET morale = 100 WHERE garage_id = ?', [e[1] as number]);
    const after = garageBonuses(db, e[1] as number);
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  });

  it('can send an unhappy mechanic away, and keeps a content one', () => {
    const db = world('morale-quit');
    const garage = Number(scalar(db, 'SELECT id FROM garage WHERE is_player = 1'));
    db.run(
      "INSERT INTO staff (garage_id, name, skill, wage_per_week, hired_on, morale) VALUES (?, 'Happy', 50, 500, '2031-02-01', 80), (?, 'Unhappy', 50, 500, '2031-02-01', 0)",
      [garage, garage],
    );
    let gone = 0;
    // At 0 morale a mechanic leaves with a chance of 30% a year, so some year in 40 sees them go.
    for (let year = 2032; year < 2072 && gone === 0; year++) gone = leaveUnhappy(db, year).length;
    expect(gone).toBe(1);
    expect(scalar(db, "SELECT COUNT(*) FROM staff WHERE name = 'Happy' AND left_on IS NULL")).toBe(
      1,
    );
    expect(
      scalar(db, "SELECT COUNT(*) FROM staff WHERE name = 'Unhappy' AND left_on IS NULL"),
    ).toBe(0);
  });
});
