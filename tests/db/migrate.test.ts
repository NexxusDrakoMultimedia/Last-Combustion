// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer, readCareer } from '../../src/db/career';
import {
  getSchemaVersion,
  latestSchemaVersion,
  migrate,
  type Migration,
} from '../../src/db/migrate';
import { migrations } from '../../src/db/migrations';
import { loadSql, openDatabase, type SqlJsStatic } from '../../src/db/sql';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

describe('rebuilding the negotiation tables (schema versions 11 and 12)', () => {
  it('keeps existing negotiations and offers, and allows the new kind', () => {
    const db = openDatabase(SQL);
    migrate(db, migrations.slice(0, 10));
    expect(getSchemaVersion(db)).toBe(10);
    db.exec(`INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
             VALUES ('driver_contract', '2031', 'garage', 1, 'driver', 2, 3, 50000, 52000)`);
    db.exec(`INSERT INTO offer (negotiation_id, round_no, from_side, terms, value, outcome)
             VALUES (1, 1, 'a', '{}', 40000, 'countered')`);
    migrate(db);
    expect(getSchemaVersion(db)).toBe(latestSchemaVersion());
    expect(db.exec('SELECT kind, walk_away FROM negotiation')[0]!.values).toEqual([
      ['driver_contract', 52000],
    ]);
    expect(db.exec('SELECT negotiation_id, value FROM offer')[0]!.values).toEqual([[1, 40000]]);
    db.exec(`INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
             VALUES ('sponsor_deal', '2031', 'garage', 1, 'sponsor', 1, 3, 30000, 30000)`);
    expect(db.exec('SELECT COUNT(*) FROM negotiation')[0]!.values[0]![0]).toBe(2);
    expect(() =>
      db.exec(`INSERT INTO negotiation (kind, window, party_a_type, party_a_id, party_b_type, party_b_id, patience_left, fair_value, walk_away)
               VALUES ('nonsense', '2031', 'garage', 1, 'x', 1, 3, 1, 1)`),
    ).toThrow();
    const offerSql = String(
      db.exec("SELECT sql FROM sqlite_master WHERE name = 'offer'")[0]!.values[0]![0],
    );
    expect(offerSql).toMatch(/REFERENCES "?negotiation"?\s*\(/);
    expect(offerSql).not.toContain('negotiation_v2');
  });
});

describe('migrate', () => {
  it('brings an empty database to the latest version', () => {
    const db = openDatabase(SQL);
    expect(getSchemaVersion(db)).toBe(0);
    const result = migrate(db);
    expect(result.from).toBe(0);
    expect(result.to).toBe(latestSchemaVersion());
    expect(result.applied).toEqual([
      'initial',
      'world',
      'prelims',
      'final',
      'economy',
      'market',
      'parts',
      'auctions',
      'negotiation',
      'preferred_number',
      'sponsors',
      'deals',
      'repairs',
      'standings',
      'almanac',
      'titles',
      'trophies',
      'world_events',
      'identity',
      'easter_egg',
      'owner',
      'starter',
      'prize_share',
      'garage_finances',
      'gear_wear',
      'training',
      'plates',
      'staff',
      'executives',
      'supply',
      'awards',
      'headquarters',
      'daily_life',
      'restorations',
      'garage_champions',
      'car_retirement',
      'continental_tier',
      'facilities',
    ]);
  });

  it('does nothing when run again', () => {
    const db = openDatabase(SQL);
    migrate(db);
    expect(migrate(db).applied).toEqual([]);
  });

  it('applies only the missing migrations', () => {
    const list: Migration[] = [
      { version: 1, name: 'one', sql: 'CREATE TABLE a (x INTEGER);' },
      { version: 2, name: 'two', sql: 'CREATE TABLE b (y INTEGER);' },
    ];
    const db = openDatabase(SQL);
    migrate(db, list.slice(0, 1));
    expect(migrate(db, list).applied).toEqual(['two']);
    expect(getSchemaVersion(db)).toBe(2);
  });

  it('rolls back a failing migration and keeps the old version', () => {
    const list: Migration[] = [
      { version: 1, name: 'one', sql: 'CREATE TABLE a (x INTEGER);' },
      { version: 2, name: 'bad', sql: 'CREATE TABLE b (y INTEGER); THIS IS NOT SQL;' },
    ];
    const db = openDatabase(SQL);
    expect(() => migrate(db, list)).toThrow();
    expect(getSchemaVersion(db)).toBe(1);
    expect(db.exec("SELECT name FROM sqlite_master WHERE name = 'b'")).toEqual([]);
  });

  it('refuses a database from a newer game version', () => {
    const db = openDatabase(SQL);
    db.exec('PRAGMA user_version = 999');
    expect(() => migrate(db)).toThrow(/newer|only understands/);
  });

  it('rejects a migration list with gaps', () => {
    const db = openDatabase(SQL);
    expect(() => migrate(db, [{ version: 2, name: 'gap', sql: '' }])).toThrow(/expected 1/);
  });
});

describe('career', () => {
  it('stores and reads back a career', () => {
    const db = openDatabase(SQL);
    migrate(db);
    createCareer(db, {
      mode: 'owner_driver',
      masterSeed: 'seed-1',
      startYear: 2031,
      difficulty: 'hard',
    });
    expect(readCareer(db)).toEqual({
      mode: 'owner_driver',
      masterSeed: 'seed-1',
      startYear: 2031,
      gameDate: '2031-02-01',
      difficulty: 'hard',
      founderCareer: false,
    });
  });

  it('allows only one career per database', () => {
    const db = openDatabase(SQL);
    migrate(db);
    const career = {
      mode: 'garage_owner',
      masterSeed: 's',
      startYear: 2031,
      difficulty: 'standard',
    } as const;
    createCareer(db, career);
    expect(() => createCareer(db, career)).toThrow();
  });

  it('rejects an unknown mode', () => {
    const db = openDatabase(SQL);
    migrate(db);
    expect(() =>
      createCareer(db, {
        mode: 'nonsense' as never,
        masterSeed: 's',
        startYear: 2031,
        difficulty: 'standard',
      }),
    ).toThrow();
  });
});

describe('headquarters (schema version 32)', () => {
  function oldSave() {
    const db = openDatabase(SQL);
    migrate(db, migrations.slice(0, 31));
    expect(getSchemaVersion(db)).toBe(31);
    const place = (stable: string) =>
      Number(db.exec(`SELECT id FROM place WHERE stable_id = '${stable}'`)[0]?.values[0]?.[0]);
    return { db, place };
  }

  it('keeps each garage’s old place as its headquarters and moves a foreign base to Australia', () => {
    const { db } = oldSave();
    db.exec(`INSERT INTO place (stable_id, name, region, country, latitude, longitude) VALUES
      ('au-test-a', 'Alphaville', 'SA', 'AU', -34, 138), ('au-test-b', 'Betatown', 'Vic', 'AU', -37, 145),
      ('gb-test', 'Londonish', 'England', 'GB', 51, 0)`);
    const id = (s: string) =>
      Number(db.exec(`SELECT id FROM place WHERE stable_id = '${s}'`)[0]!.values[0]![0]);
    const garage = (n: number, place: string, state: string) =>
      db.exec(`INSERT INTO garage (id, name, flag, base_place_id, home_state, primary_colour, secondary_colour, prestige, cash, founded_year, is_player, ai_profile, fans)
               VALUES (${n}, 'G${n}', 'GB', ${id(place)}, '${state}', '#000000', '#ffffff', 5, 0, 2020, 0, 'cautious', 0)`);
    garage(1, 'gb-test', 'England');
    garage(2, 'au-test-a', 'SA');
    migrate(db);
    expect(getSchemaVersion(db)).toBe(latestSchemaVersion());
    const rows = db.exec(
      `SELECT g.id, hq.stable_id, base.country, base.region, g.home_state FROM garage g
         JOIN place hq ON hq.id = g.hq_place_id JOIN place base ON base.id = g.base_place_id ORDER BY g.id`,
    )[0]!.values;
    // The foreign garage keeps London as its headquarters but is now based in Australia.
    expect(rows[0]![1]).toBe('gb-test');
    expect(rows[0]![2]).toBe('AU');
    expect(rows[0]![4]).toBe(rows[0]![3]);
    // An Australian garage is untouched: same base, same headquarters.
    expect(rows[1]![1]).toBe('au-test-a');
    expect(rows[1]![2]).toBe('AU');
    expect(rows[1]![3]).toBe('SA');
  });
});

describe('garage champions (schema version 35)', () => {
  it('moves the old garage column to its clearer name and fills the Garage Championship winner from the saved table', () => {
    const db = openDatabase(SQL);
    migrate(db, migrations.slice(0, 34));
    expect(getSchemaVersion(db)).toBe(34);
    db.exec(`INSERT INTO season (id, year, era, final_size, series_fans, status, champion_garage_id)
             VALUES (1, 2031, 'original', 15, 100, 'complete', 7), (2, 2032, 'original', 15, 100, 'scheduled', NULL)`);
    db.exec(`INSERT INTO standing_snapshot (season_id, table_kind, subject, after_round, points, wins, position)
             VALUES (1, 'garage', '12', 6, 90, 3, 1), (1, 'garage', '7', 6, 80, 2, 2), (1, 'driver', '5', 6, 50, 3, 1)`);
    migrate(db);
    const rows = db.exec(
      'SELECT year, champion_driver_garage_id, champion_garage_id FROM season ORDER BY year',
    )[0]!.values;
    // The old value is kept under its new name; the winner comes from the garage table.
    expect(rows[0]).toEqual([2031, 7, 12]);
    expect(rows[1]).toEqual([2032, null, null]);
  });
});

describe('car retirement (schema version 36)', () => {
  it('adds a retired year to cars and leaves existing cars active', () => {
    const db = openDatabase(SQL);
    migrate(db, migrations.slice(0, 35));
    expect(getSchemaVersion(db)).toBe(35);
    migrate(db, migrations.slice(0, 36));
    expect(getSchemaVersion(db)).toBe(36);
    const columns = db.exec('PRAGMA table_info(car)')[0]!.values.map((v) => v[1]);
    expect(columns).toContain('retired_year');
  });
});

describe('the continental tier (schema version 37)', () => {
  const tierRows = (db: ReturnType<typeof openDatabase>) =>
    db.exec("SELECT stable_id FROM sponsor WHERE tier = 'continental' ORDER BY id")[0]?.values ??
    [];

  it('adds the continental sponsors to a career that already has its sponsors', () => {
    const db = openDatabase(SQL);
    migrate(db, migrations.slice(0, 36));
    db.exec(
      "INSERT INTO sponsor VALUES (1, 'wattle-hardware', 'Wattle Hardware Co.', 'AU', 'local', 1, 30)",
    );
    db.exec('INSERT INTO sponsor_deal VALUES (1, 1, 1, 2031, 2032, 40000, 1)');
    migrate(db, migrations.slice(0, 37));
    expect(getSchemaVersion(db)).toBe(37);
    expect(tierRows(db)).toHaveLength(3);
    expect(db.exec('SELECT sponsor_id FROM sponsor_deal')[0]!.values[0]![0]).toBe(1);
    expect(db.exec('SELECT name FROM sponsor WHERE id = 1')[0]!.values[0]![0]).toBe(
      'Wattle Hardware Co.',
    );
  });

  it('adds nothing to a new world, which is filled in from the data files', () => {
    const db = openDatabase(SQL);
    migrate(db);
    expect(db.exec('SELECT COUNT(*) FROM sponsor')[0]!.values[0]![0]).toBe(0);
  });
});

describe('facilities (schema version 38)', () => {
  it('adds a table of facilities that holds a level from 1 to 5', () => {
    const db = openDatabase(SQL);
    migrate(db, migrations.slice(0, 37));
    migrate(db);
    expect(getSchemaVersion(db)).toBe(38);
    const columns = db.exec('PRAGMA table_info(facility)')[0]!.values.map((v) => v[1]);
    expect(columns).toEqual(['garage_id', 'kind', 'level']);
    expect(() => db.exec("INSERT INTO facility VALUES (1, 'data_room', 6)")).toThrow();
  });
});
