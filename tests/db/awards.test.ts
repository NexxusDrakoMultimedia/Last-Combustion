// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { seasonAwards, type AwardWon } from '../../src/db/awards';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { settleRound } from '../../src/db/finance';
import { playPrelims } from '../../src/db/prelims';
import { recordBook } from '../../src/db/records';
import { startNextSeason } from '../../src/db/rollover';
import { endSeason } from '../../src/db/season';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { AWARDS } from '../../src/sim/awards';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function playSeason(db: Database): void {
  for (let n = 1; n <= 6; n++) {
    playPrelims(db, n);
    playFinal(db, n);
    settleRound(db, n);
  }
}

describe('season awards over two seasons', () => {
  let db: Database;
  let first: ReturnType<typeof endSeason>;
  let second: ReturnType<typeof endSeason>;
  beforeAll(() => {
    db = createNewDatabase(SQL);
    createCareer(db, {
      mode: 'garage_owner',
      masterSeed: 'awards-db',
      startYear: 2031,
      difficulty: 'standard',
    });
    persistWorld(db, generateWorld('awards-db'));
    playSeason(db);
    first = endSeason(db);
    startNextSeason(db);
    playSeason(db);
    second = endSeason(db);
  }, 240_000);

  const byAward = (list: AwardWon[], id: string) => list.find((a) => a.award === id);

  it('gives the first season its fan, charging, pole and overtaking awards, but no rookie or improver', () => {
    const ids = first.awards.map((a) => a.award);
    expect(ids).toContain('fan_favourite');
    expect(ids).toContain('hard_charger');
    expect(ids).toContain('pole_sitter');
    expect(ids).not.toContain('rookie_of_the_year');
    expect(ids).not.toContain('most_improved');
    expect(ids).not.toContain('most_improved_garage');
    for (const a of first.awards) expect(AWARDS.map((x) => x.id)).toContain(a.award);
    expect(seasonAwards(db, 2031).map((a) => a.award)).toEqual(ids);
  });

  it('gives the pole award to whoever took the most poles', () => {
    const top = db.exec(
      `SELECT e.driver_id, COUNT(*) AS n FROM result r JOIN entry e ON e.id = r.entry_id
        WHERE r.pole = 1 AND e.series = 'main' AND r.round_id IN (SELECT id FROM round WHERE season_id = 1)
        GROUP BY e.driver_id ORDER BY n DESC LIMIT 1`,
    )[0]!.values[0]!;
    const award = byAward(first.awards, 'pole_sitter')!;
    expect(award.value).toBe(top[1]);
    const tied = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM (SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id
          WHERE r.pole = 1 AND e.series = 'main' AND r.round_id IN (SELECT id FROM round WHERE season_id = 1)
          GROUP BY e.driver_id HAVING COUNT(*) = ${String(top[1])})`,
      ),
    );
    if (tied === 1) expect(award.subjectId).toBe(top[0]);
  });

  it('rewards the places gained in the finals with the hard charger award', () => {
    const award = byAward(first.awards, 'hard_charger')!;
    expect(award.value).toBeGreaterThan(0);
    const gained = Number(
      scalar(
        db,
        `SELECT SUM(r.prelim_pos - r.final_pos) FROM result r JOIN entry e ON e.id = r.entry_id
          WHERE e.driver_id = ${award.subjectId} AND e.series = 'main' AND r.final_pos IS NOT NULL
            AND r.prelim_pos IS NOT NULL AND r.dnf_reason IS NULL
            AND r.round_id IN (SELECT id FROM round WHERE season_id = 1)`,
      ),
    );
    expect(gained).toBe(award.value);
  });

  it('names a rookie of the year only from the second season, and only from a first-season driver', () => {
    const rookie = byAward(second.awards, 'rookie_of_the_year');
    expect(rookie).toBeDefined();
    const earlier = Number(
      scalar(
        db,
        `SELECT COUNT(*) FROM entry e JOIN season s ON s.id = e.season_id
          WHERE e.driver_id = ${rookie!.subjectId} AND s.year < 2032`,
      ),
    );
    expect(earlier).toBe(0);
  });

  it('rewards the most places climbed in the table, and the garage that climbed most', () => {
    const driver = byAward(second.awards, 'most_improved')!;
    expect(driver.value).toBeGreaterThan(0);
    const before = Number(
      scalar(
        db,
        `SELECT position FROM standing_snapshot WHERE season_id = 1 AND table_kind = 'driver' AND subject = '${driver.subjectId}'`,
      ),
    );
    const after = Number(
      scalar(
        db,
        `SELECT position FROM standing_snapshot WHERE season_id = 2 AND table_kind = 'driver' AND subject = '${driver.subjectId}'`,
      ),
    );
    expect(before - after).toBe(driver.value);
    const garage = byAward(second.awards, 'most_improved_garage')!;
    expect(garage.subjectType).toBe('garage');
    expect(garage.value).toBeGreaterThan(0);
  });

  it('gives each award once a season', () => {
    expect(
      Number(
        scalar(
          db,
          'SELECT MAX(n) FROM (SELECT COUNT(*) AS n FROM season_award GROUP BY season_id, award)',
        ),
      ),
    ).toBe(1);
  });

  it('builds the record book with every season’s champions and awards, newest first', () => {
    const book = recordBook(db);
    expect(book.seasons.map((s) => s.year)).toEqual([2032, 2031]);
    expect(book.seasons[0]!.awards.length).toBe(second.awards.length);
    expect(book.seasons[1]!.championPoints).toBeGreaterThan(0);
    const ids = book.records.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining(['driver_points', 'driver_wins', 'driver_season_points']),
    );
    const seasonPoints = book.records.find((r) => r.id === 'driver_season_points')!;
    expect([2031, 2032]).toContain(seasonPoints.year);
    const careerPoints = book.records.find((r) => r.id === 'driver_points')!;
    expect(careerPoints.value).toBeGreaterThanOrEqual(seasonPoints.value);
  });

  it('gives every record a leaderboard of everyone with a non-zero score, best first', () => {
    const book = recordBook(db);
    for (const r of book.records) {
      expect(r.board.length, r.id).toBeGreaterThan(0);
      expect(r.board[0]).toMatchObject({ name: r.holder, value: r.value, subjectId: r.subjectId });
      for (const row of r.board) expect(row.value, r.id).toBeGreaterThan(0);
      for (let i = 1; i < r.board.length; i++)
        expect(r.board[i]!.value, r.id).toBeLessThanOrEqual(r.board[i - 1]!.value);
      expect(new Set(r.board.map((row) => row.subjectId)).size, r.id).toBe(r.board.length);
    }
    // Career points: exactly the drivers who have scored.
    const scorers = Number(
      db.exec(
        `SELECT COUNT(*) FROM (SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id
           WHERE e.series = 'main' GROUP BY e.driver_id HAVING SUM(r.points) > 0)`,
      )[0]!.values[0]![0],
    );
    expect(book.records.find((r) => r.id === 'driver_points')!.board).toHaveLength(scorers);
  });
});
