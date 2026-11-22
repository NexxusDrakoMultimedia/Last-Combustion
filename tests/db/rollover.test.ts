// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { hasText } from '../../src/i18n';
import { createCareer, readCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { addEntry } from '../../src/db/garage';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { readSeasonStory } from '../../src/db/fans';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { seasonBuzz, seriesGrowth } from '../../src/sim/fans';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function playedSeason(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  for (let n = 1; n <= 6; n++) {
    playPrelims(db, n);
    playFinal(db, n);
    settleRound(db, n);
  }
  endSeason(db);
  return db;
}

describe('starting the next season', () => {
  let db: Database;
  let result: ReturnType<typeof startNextSeason>;
  const before = new Map<number, number>();
  beforeAll(() => {
    db = playedSeason('rollover');
    for (const [id, pace] of db.exec('SELECT id, pace FROM driver')[0]!.values as [
      number,
      number,
    ][])
      before.set(id, pace);
    result = startNextSeason(db);
  }, 180_000);

  it('opens 2032 with a calendar and a full field', () => {
    expect(result.year).toBe(2032);
    expect(scalar(db, 'SELECT status FROM season WHERE year = 2032')).toBe('scheduled');
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM round WHERE season_id = (SELECT id FROM season WHERE year = 2032)',
      ),
    ).toBe(6);
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM entry WHERE season_id = (SELECT id FROM season WHERE year = 2032)',
      ),
    ).toBe(result.entries);
    expect(result.garagesClosed).toBe(0);
    expect(result.entries).toBe(313 + result.garagesOpened);
    expect(readCareer(db)!.gameDate).toBe('2032-02-01');
  });

  it("gives numbers 1 to 40 by last season's table, never #313, and keeps numbers unique", () => {
    const rows = db.exec(
      `SELECT e.race_number, s.position FROM entry e
         JOIN standing_snapshot s ON s.subject = CAST(e.driver_id AS TEXT) AND s.table_kind = 'driver'
        WHERE e.season_id = (SELECT id FROM season WHERE year = 2032) AND e.race_number <= 40`,
    )[0]!.values as number[][];
    expect(rows.length).toBe(40);
    expect(
      scalar(
        db,
        'SELECT COUNT(DISTINCT race_number) FROM entry WHERE season_id = (SELECT id FROM season WHERE year = 2032)',
      ),
    ).toBe(result.entries);
    expect(
      scalar(
        db,
        'SELECT COUNT(*) FROM entry WHERE season_id = (SELECT id FROM season WHERE year = 2032) AND race_number = 313 AND driver_id IS NOT NULL',
      ),
    ).toBeLessThanOrEqual(1);
  });

  it('replaces retirees with rookies in the same seat and contracts them', () => {
    expect(result.retired).toBe(result.rookies);
    expect(scalar(db, 'SELECT COUNT(*) FROM driver WHERE retired_year = 2031')).toBe(
      result.retired,
    );
    expect(Number(scalar(db, 'SELECT COUNT(*) FROM driver'))).toBeGreaterThanOrEqual(
      313 + result.rookies,
    );
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry e JOIN driver d ON d.id = e.driver_id
          WHERE e.season_id = (SELECT id FROM season WHERE year = 2032) AND d.retired_year IS NOT NULL`,
      ),
    ).toBe(0);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry e WHERE e.season_id = (SELECT id FROM season WHERE year = 2032)
           AND NOT EXISTS (SELECT 1 FROM contract c WHERE c.driver_id = e.driver_id AND c.end_year >= 2032)`,
      ),
    ).toBe(0);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('develops the drivers who carry on: the young gain and the old slip', () => {
    const rows = db.exec(
      `SELECT d.id, d.birth_date, d.pace FROM driver d WHERE d.retired_year IS NULL AND d.id <= 313`,
    )[0]!.values as [number, string, number][];
    const changed = rows.filter(([id, , pace]) => before.get(id) !== pace).length;
    expect(changed).toBeGreaterThan(100);
    const avg = (pick: (born: number) => boolean) => {
      const diffs = rows
        .filter(([, born]) => pick(Number(born.slice(0, 4))))
        .map(([id, , pace]) => pace - before.get(id)!);
      return diffs.reduce((t, x) => t + x, 0) / diffs.length;
    };
    expect(avg((born) => born >= 2008)).toBeGreaterThan(0);
    expect(avg((born) => born <= 1994)).toBeLessThan(0);
  });

  it('refurbishes the worn gear of computer garages that can pay', () => {
    const wornRich = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM driver_gear dg
          WHERE dg.wear > 50 AND dg.item_id IN (SELECT id FROM gear_item WHERE price > 0)
            AND dg.driver_id IN (
              SELECT e.driver_id FROM entry e JOIN garage g ON g.id = e.garage_id
               WHERE g.is_player = 0 AND g.cash > 2000000
                 AND e.season_id = (SELECT id FROM season WHERE year = 2032))`,
      ),
    );
    expect(wornRich).toBe(0);
    expect(
      Number(
        scalar(db, "SELECT COUNT(*) FROM ledger WHERE category = 'gear' AND round_id IS NULL"),
      ),
    ).toBeGreaterThan(0);
  });

  it('only writes ledger categories the Money panel has a name for', () => {
    const categories = db
      .exec('SELECT DISTINCT category FROM ledger')[0]!
      .values.map((v) => String(v[0]));
    expect(categories.length).toBeGreaterThan(5);
    for (const c of categories) expect(hasText(`money.category.${c}`), c).toBe(true);
  });

  it('grows the series audience by 26% for the new season, half a percent more for each attention flag and the buzz', () => {
    const s = (year: number) =>
      Number(scalar(db, `SELECT series_fans FROM season WHERE year = ${year}`));
    const flags = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM event_log ev JOIN round ro ON ro.id = ev.round_id
          WHERE ev.type = 'attention' AND ro.season_id = (SELECT id FROM season WHERE year = 2031)`,
      ),
    );
    const buzz = Number(scalar(db, 'SELECT buzz FROM season WHERE year = 2031'));
    expect(s(2032)).toBe(Math.round(s(2031) * (1.26 + 0.005 * flags + buzz)));
  });

  it('carries the flag fans over into the new season', () => {
    const rows = (year: number) =>
      Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM flag_fans WHERE season_id = (SELECT id FROM season WHERE year = ${year})`,
        ),
      );
    expect(rows(2032)).toBe(rows(2031));
    expect(rows(2032)).toBeGreaterThan(200);
  });

  it('gives a withdrawn ranked driver the same number when they are seated again', () => {
    const row = db.exec(
      `SELECT e.garage_id, e.driver_id, e.car_id, e.race_number FROM entry e
         WHERE e.season_id = (SELECT MAX(id) FROM season) AND e.series = 'main' AND e.race_number <= 40
         ORDER BY e.race_number DESC LIMIT 1`,
    )[0]!.values[0] as number[];
    const [garageId, driverId, carId, number] = row as [number, number, number, number];
    db.run(
      "DELETE FROM entry WHERE season_id = (SELECT MAX(id) FROM season) AND series = 'main' AND driver_id = ?",
      [driverId],
    );
    const again = addEntry(db, garageId, carId, driverId);
    expect(again.raceNumber).toBe(number);
  });

  it('cannot start twice, or before the season ends', () => {
    expect(() => startNextSeason(db)).toThrow(/not ended/);
  });
  describe('the buzz the season left', () => {
    const id = () => Number(scalar(db, 'SELECT id FROM season WHERE year = 2031'));

    it('is kept on the season and is within bounds', () => {
      const buzz = Number(scalar(db, 'SELECT buzz FROM season WHERE year = 2031'));
      expect(buzz).toBeGreaterThanOrEqual(0);
      expect(buzz).toBeLessThanOrEqual(0.15);
      expect(Number(scalar(db, 'SELECT buzz FROM season WHERE year = 2032'))).toBe(0);
      // Winners and the title gap are fixed once the season ends, so they are a floor for the buzz.
      const story = readSeasonStory(db, id());
      expect(buzz).toBeGreaterThanOrEqual(seasonBuzz({ ...story, rivalryPoints: 0 }) - 1e-9);
      expect(buzz).toBeGreaterThan(0);
    });

    it('is added to the growth of the series audience', () => {
      const flags = Number(
        scalar(
          db,
          `SELECT COUNT(*) FROM event_log ev JOIN round ro ON ro.id = ev.round_id
            WHERE ro.season_id = ${id()} AND ev.type = 'attention'`,
        ),
      );
      const buzz = Number(scalar(db, 'SELECT buzz FROM season WHERE year = 2031'));
      const before = Number(scalar(db, 'SELECT series_fans FROM season WHERE year = 2031'));
      expect(Number(scalar(db, 'SELECT series_fans FROM season WHERE year = 2032'))).toBe(
        Math.round(before * (1 + seriesGrowth(2032, flags, buzz))),
      );
    });

    it('reads the story of the season, with live rivalries weighed by level', () => {
      const story = readSeasonStory(db, id());
      expect(story.rounds).toBe(6);
      expect(story.winners).toBeGreaterThan(0);
      expect(story.winners).toBeLessThanOrEqual(6);
      expect(story.titleGapShare).toBeGreaterThanOrEqual(0);
      expect(story.titleGapShare).toBeLessThanOrEqual(1);
      const [a, b] = (
        db.exec('SELECT id FROM driver ORDER BY id DESC LIMIT 2')[0]!.values as number[][]
      )
        .map((r) => r[0]!)
        .sort((x, y) => x - y);
      db.run(
        `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
         VALUES (?, ?, 95, 95, 'feud', 1, 2031)`,
        [a!, b!],
      );
      expect(readSeasonStory(db, id()).rivalryPoints).toBe(story.rivalryPoints + 3);
      db.run('DELETE FROM rivalry WHERE driver_a = ? AND driver_b = ?', [a!, b!]);
    });

    it('matches the pure rule for the first season, which has no word of mouth to carry', () => {
      expect(seasonBuzz({ titleGapShare: 0, rounds: 6, winners: 6, rivalryPoints: 0 })).toBeCloseTo(
        0.05,
        5,
      );
    });
  });
});

describe('a dragon-blooded driver who retires', () => {
  it('founds a garage in their home nation, with a name from it', () => {
    const db = playedSeason('dragon-founder');
    const [driverId, nationality, name] = db.exec(
      `SELECT d.id, d.nationality, d.name FROM driver d JOIN entry e ON e.driver_id = d.id
        WHERE d.easter_egg = 1 AND d.nationality != 'AU'
          AND e.season_id = (SELECT MAX(id) FROM season) LIMIT 1`,
    )[0]!.values[0] as [number, string, string];
    // Past the forced retirement age, so they retire at this rollover.
    db.run("UPDATE driver SET birth_date = '1960-01-01' WHERE id = ?", [driverId]);
    const before = Number(scalar(db, 'SELECT COUNT(*) FROM garage'));
    startNextSeason(db);
    expect(Number(scalar(db, `SELECT retired_year FROM driver WHERE id = ${driverId}`))).toBe(2031);
    const founded = db.exec(
      `SELECT g.name, g.flag, hq.country, base.country, g.founded_year FROM garage g
         JOIN place hq ON hq.id = g.hq_place_id JOIN place base ON base.id = g.base_place_id
        WHERE g.founded_year = 2032 AND g.flag = '${nationality}'
          AND g.hq_place_id = (SELECT hometown_place_id FROM driver WHERE id = ${driverId})`,
    )[0]!.values as [string, string, string, string, number][];
    expect(Number(scalar(db, 'SELECT COUNT(*) FROM garage'))).toBeGreaterThan(before);
    expect(founded.length).toBeGreaterThan(0);
    const [garageName, flag, hqCountry, baseCountry] = founded[0]!;
    expect(flag).toBe(nationality);
    expect(hqCountry).toBe(nationality === 'GB' ? 'GB' : nationality);
    expect(baseCountry).toBe('AU');
    expect(garageName.length, name).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  it('gives the same new season for the same seed', () => {
    const a = playedSeason('same');
    const b = playedSeason('same');
    expect(startNextSeason(a)).toEqual(startNextSeason(b));
    const q =
      'SELECT group_concat(driver_id || ":" || race_number) FROM (SELECT driver_id, race_number FROM entry WHERE season_id = 2 ORDER BY id)';
    expect(scalar(a, q)).toBe(scalar(b, q));
  }, 240_000);
});

describe('garages closing and opening at the rollover', () => {
  let db: Database;
  let result: ReturnType<typeof startNextSeason>;
  let doomed: number;
  let doomedDriver: number;
  let doomedCar: number;
  let playerId: number;
  beforeAll(() => {
    db = playedSeason('garages-rollover');
    // One computer garage has been broke for a year already and is deep in debt; the player's garage is too.
    const row = db.exec(
      `SELECT g.id, e.driver_id, e.car_id FROM garage g JOIN entry e ON e.garage_id = g.id
        WHERE g.kind = 'racing' AND g.is_player = 0
        GROUP BY g.id ORDER BY g.id LIMIT 1`,
    )[0]!.values[0] as number[];
    [doomed, doomedDriver, doomedCar] = row as [number, number, number];
    db.run('UPDATE garage SET cash = -90000000, broke_years = 1 WHERE id = ?', [doomed]);
    // A garage that began in an earlier version of the game as Drake Motorsports never folds, however broke.
    playerId = Number(
      scalar(db, `SELECT id FROM garage WHERE id <> ${doomed} ORDER BY id LIMIT 1`),
    );
    db.run(
      "UPDATE garage SET name = 'Drake Motorsports', cash = -90000000, broke_years = 5 WHERE id = ?",
      [playerId],
    );
    result = startNextSeason(db);
  }, 180_000);

  it('folds a computer garage after a second broke year and lists its cars', () => {
    expect(result.garagesClosed).toBeGreaterThanOrEqual(1);
    expect(scalar(db, `SELECT closed_year FROM garage WHERE id = ${doomed}`)).toBe(2031);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry WHERE garage_id = ${doomed} AND season_id = (SELECT id FROM season WHERE year = 2032)`,
      ),
    ).toBe(0);
    expect(
      scalar(
        db,
        `SELECT g.kind FROM car c JOIN garage g ON g.id = c.garage_id WHERE c.id = ${doomedCar}`,
      ),
    ).toBe('market');
    expect(
      scalar(db, `SELECT status FROM market_listing WHERE car_id = ${doomedCar} ORDER BY id DESC`),
    ).toBe('open');
    // Its driver is a free agent unless a new garage signed them, and its contract ended with the garage.
    expect(
      scalar(db, `SELECT COUNT(*) FROM contract WHERE garage_id = ${doomed} AND end_year >= 2032`),
    ).toBe(0);
    expect(scalar(db, `SELECT retired_year FROM driver WHERE id = ${doomedDriver}`) === null).toBe(
      true,
    );
  });

  it('never folds Drake Motorsports', () => {
    expect(scalar(db, `SELECT closed_year FROM garage WHERE id = ${playerId}`)).toBeNull();
  });

  it('bases every garage, new ones included, in an Australian state or territory', () => {
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM garage g JOIN place p ON p.id = g.base_place_id
          WHERE g.kind = 'racing' AND p.country <> 'AU'`,
      ),
    ).toBe(0);
    expect(
      scalar(
        db,
        `SELECT COUNT(*) FROM garage g JOIN place p ON p.id = g.base_place_id WHERE g.home_state <> p.region`,
      ),
    ).toBe(0);
    expect(scalar(db, 'SELECT COUNT(*) FROM garage WHERE hq_place_id IS NULL')).toBe(0);
  });

  it('opens three to ten new garages, each with a driver, a starter car and an entry', () => {
    expect(result.garagesOpened).toBeGreaterThanOrEqual(3);
    expect(result.garagesOpened).toBeLessThanOrEqual(10);
    const fresh = db
      .exec(`SELECT g.id FROM garage g WHERE g.founded_year = 2032 AND g.kind = 'racing'`)[0]!
      .values.map((v) => v[0] as number);
    expect(fresh.length).toBe(result.garagesOpened);
    for (const id of fresh) {
      expect(
        scalar(
          db,
          `SELECT COUNT(*) FROM entry e JOIN contract c ON c.driver_id = e.driver_id AND c.garage_id = e.garage_id
            WHERE e.garage_id = ${id} AND e.season_id = (SELECT id FROM season WHERE year = 2032)`,
        ),
      ).toBe(1);
      expect(scalar(db, `SELECT fans FROM garage WHERE id = ${id}`)).toBe(5);
    }
    expect(
      scalar(
        db,
        `SELECT COUNT(*) - COUNT(DISTINCT driver_id) FROM entry WHERE season_id = (SELECT id FROM season WHERE year = 2032)`,
      ),
    ).toBe(0);
    expect(db.exec('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('pays computer garages their sponsorship at the season end', () => {
    expect(
      Number(
        scalar(db, "SELECT COUNT(*) FROM ledger WHERE category = 'sponsor' AND round_id IS NULL"),
      ),
    ).toBeGreaterThan(50);
  });

  it('gives the same garages for the same seed', () => {
    const again = playedSeason('garages-rollover');
    again.run('UPDATE garage SET cash = -90000000, broke_years = 1 WHERE id = ?', [doomed]);
    again.run(
      "UPDATE garage SET name = 'Drake Motorsports', cash = -90000000, broke_years = 5 WHERE id = ?",
      [playerId],
    );
    startNextSeason(again);
    const names = (d: Database) =>
      d.exec('SELECT name FROM garage WHERE founded_year = 2032 ORDER BY id')[0]!.values.join('|');
    expect(names(again)).toBe(names(db));
  }, 180_000);
});
