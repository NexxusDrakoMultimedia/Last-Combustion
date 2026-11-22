// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureBusinesses, settleBusinesses } from '../../src/db/business';
import { createCareer } from '../../src/db/career';
import { ensureCapTables } from '../../src/db/equity';
import { peopleIndex, personProfile } from '../../src/db/people';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { retireScouts } from '../../src/db/scouts';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { computerScoutSlots } from '../../src/sim/scouting';
import { generateWorld } from '../../src/sim/worldgen';
import { scoutingBalance } from '../../src/sim/worldgen/data';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Scout Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const rows = (db: Database, sql: string) => db.exec(sql)[0]?.values ?? [];

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
  return db;
}

const COMPUTER = "kind = 'racing' AND is_player = 0 AND closed_year IS NULL";

describe('computer garages employ scouts', () => {
  it('as many as their prestige can afford, no more than a garage may have, and none below the first rung', () => {
    expect(computerScoutSlots(0)).toBe(0);
    expect(computerScoutSlots(scoutingBalance.staff.computerFirstAt - 1)).toBe(0);
    expect(computerScoutSlots(scoutingBalance.staff.computerFirstAt)).toBe(1);
    expect(computerScoutSlots(1000)).toBe(scoutingBalance.staff.maxPerGarage);
    let last = 0;
    for (let p = 0; p <= 120; p++) {
      expect(computerScoutSlots(p)).toBeGreaterThanOrEqual(last);
      last = computerScoutSlots(p);
    }
  });

  it('are given to every open computer garage, up to its slots, and never more than a garage may employ', () => {
    const db = world('scout-ai');
    ensureBusinesses(db, 2031);
    let total = 0;
    for (const [id, prestige] of rows(db, `SELECT id, prestige FROM garage WHERE ${COMPUTER}`)) {
      const n = Number(
        rows(db, `SELECT COUNT(*) FROM scout WHERE garage_id = ${id} AND left_on IS NULL`)[0]![0],
      );
      expect(n).toBe(computerScoutSlots(Number(prestige)));
      expect(n).toBeLessThanOrEqual(scoutingBalance.staff.maxPerGarage);
      total += n;
    }
    expect(total).toBeGreaterThan(0);
  });

  it('are the same for the same seed, and running it again hires nobody more', () => {
    const a = world('scout-same');
    const b = world('scout-same');
    ensureBusinesses(a, 2031);
    ensureBusinesses(b, 2031);
    const dump = (db: Database) =>
      JSON.stringify(
        rows(
          db,
          'SELECT garage_id, name, skill, focus, nationality, birth_year FROM scout ORDER BY id',
        ),
      );
    expect(dump(a)).toBe(dump(b));
    const before = dump(a);
    ensureBusinesses(a, 2031);
    expect(dump(a)).toBe(before);
  });

  it('are paid from the garage books at the end of the year, so no garage ledger is left out of balance', () => {
    const db = world('scout-pay');
    ensureBusinesses(db, 2031);
    settleBusinesses(db, 2032);
    expect(
      rows(
        db,
        `SELECT g.id FROM garage g JOIN ledger l ON l.garage_id = g.id
          WHERE g.is_player = 0 AND l.date = '2031-12-31' AND l.category IN ('salaries', 'wages', 'facilities', 'sponsor')
          GROUP BY g.id HAVING SUM(l.amount) <> 0`,
      ),
    ).toEqual([]);
  });

  it('retire at the same age as the player scouts do, and the garage takes someone on to fill the seat', () => {
    const db = world('scout-retire');
    ensureBusinesses(db, 2031);
    const id = Number(
      rows(db, 'SELECT garage_id FROM scout WHERE left_on IS NULL ORDER BY id LIMIT 1')[0]![0],
    );
    db.run('UPDATE scout SET birth_year = ? WHERE garage_id = ?', [
      2031 - scoutingBalance.staff.retireAge,
      id,
    ]);
    const gone = retireScouts(db, 2031).filter((s) => s.garageId === id);
    expect(gone.length).toBeGreaterThan(0);
    ensureBusinesses(db, 2031);
    const n = Number(
      rows(db, `SELECT COUNT(*) FROM scout WHERE garage_id = ${id} AND left_on IS NULL`)[0]![0],
    );
    expect(n).toBeGreaterThan(0);
  });

  it('every one of them has a flag in the Registry, and a hometown once they are read', () => {
    const db = world('scout-flags');
    ensureBusinesses(db, 2031);
    const scouts = peopleIndex(db).filter((p) => p.kind === 'scout');
    expect(scouts.length).toBeGreaterThan(0);
    expect(scouts.every((s) => typeof s.flag === 'string' && s.flag.length > 0)).toBe(true);
    const profile = personProfile(db, 'scout', scouts[0]!.id);
    expect(profile.kind === 'scout' && profile.origin?.hometown).toBeTruthy();
  });

  it('are read through the fog at a garage the player does not own', () => {
    const db = world('scout-fog');
    ensureBusinesses(db, 2031);
    const [theirs] = rows(
      db,
      `SELECT s.id FROM scout s JOIN garage g ON g.id = s.garage_id
        WHERE g.is_player = 0 AND s.left_on IS NULL ORDER BY s.id LIMIT 1`,
    )[0]!;
    const profile = personProfile(db, 'scout', Number(theirs));
    expect(profile.kind === 'scout' && profile.skill.owned).toBe(false);
  });
});
