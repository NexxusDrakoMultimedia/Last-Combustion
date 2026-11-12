// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { courseMap, defaultMapRound, mapRounds } from '../../src/db/coursemap';
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

const one = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function world(seed: string, rounds: number): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  for (let n = 1; n <= rounds; n++) {
    playPrelims(db, n);
    playFinal(db, n);
  }
  return db;
}

describe('the map of a round', () => {
  let played: Database;
  beforeAll(() => {
    played = world('map-a', 1);
  }, 300_000);

  it('lists the rounds of the latest season', () => {
    expect(mapRounds(played)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('knows the course, its sectors and where the overtaking spots are', () => {
    const map = courseMap(played, 1)!;
    expect(map.round).toBe(1);
    expect(map.year).toBe(2031);
    expect(map.courseNumber).toBe(1);
    expect(map.name.length).toBeGreaterThan(0);
    expect(map.lapKm).toBeGreaterThan(10);
    expect(map.sectors.length).toBeGreaterThan(3);
    expect(map.sectors[0]!.startKm).toBe(0);
    expect(map.sectors.some((s) => s.overtakeSpot)).toBe(true);
  });

  it('puts the incidents of a played round on the lap, in order', () => {
    const map = courseMap(played, 1)!;
    for (const m of map.markers) {
      expect(m.km).toBeGreaterThanOrEqual(0);
      expect(m.km).toBeLessThanOrEqual(map.lapKm);
      expect(['crash', 'spin', 'mistake', 'wildlife', 'mechanical_failure', 'contact']).toContain(
        m.kind,
      );
    }
    expect(map.markers.map((m) => m.km)).toEqual(
      [...map.markers.map((m) => m.km)].sort((a, b) => a - b),
    );
  });

  it('shows a crash where it happened, and no more than 60 markers', () => {
    const id = Number(one(played, 'SELECT id FROM round WHERE number = 1 LIMIT 1'));
    played.run(
      "INSERT INTO event_log (round_id, scope, occurred_on, km, type, entry_id) VALUES (?, 'final', '2031-03-01', 7.25, 'crash', 1)",
      [id],
    );
    expect(courseMap(played, 1)!.markers.some((m) => m.km === 7.25 && m.kind === 'crash')).toBe(
      true,
    );
    for (let i = 0; i < 80; i++)
      played.run(
        "INSERT INTO event_log (round_id, scope, occurred_on, km, type, entry_id) VALUES (?, 'prelim', '2031-03-01', ?, 'spin', 1)",
        [id, i / 10],
      );
    expect(courseMap(played, 1)!.markers.length).toBeLessThanOrEqual(60);
  });

  it('leaves out events that are not incidents on the road', () => {
    const id = Number(one(played, 'SELECT id FROM round WHERE number = 1 LIMIT 1'));
    played.run(
      "INSERT INTO event_log (round_id, scope, occurred_on, km, type) VALUES (?, 'final', '2031-03-01', 3.55, 'overtake')",
      [id],
    );
    expect(courseMap(played, 1)!.markers.some((m) => m.km === 3.55)).toBe(false);
  });

  it('has no markers for a round that has not been run, and none for a round that does not exist', () => {
    expect(courseMap(played, 2)!.markers).toEqual([]);
    expect(courseMap(played, 9)).toBeUndefined();
  });

  it('opens on the last round run, or the first when none has been', () => {
    expect(defaultMapRound(played)).toBe(1);
    played.run("UPDATE round SET status = 'complete' WHERE number = 3");
    expect(defaultMapRound(played)).toBe(3);
    played.run("UPDATE round SET status = 'scheduled'");
    expect(defaultMapRound(played)).toBe(1);
  });
});

describe('a busy round', () => {
  let busy: Database;
  let lap: number;
  beforeAll(() => {
    busy = world('map-busy', 1);
    busy.run(
      "DELETE FROM event_log WHERE type IN ('crash', 'spin', 'mistake', 'wildlife', 'contact')",
    );
    lap = courseMap(busy, 1)!.lapKm;
  }, 300_000);

  const id = () => Number(one(busy, 'SELECT id FROM round WHERE number = 1 LIMIT 1'));
  const add = (scope: string, km: number | null, type = 'spin') =>
    busy.run(
      'INSERT INTO event_log (round_id, scope, occurred_on, km, type, entry_id) VALUES (?, ?, ?, ?, ?, 1)',
      [id(), scope, '2031-03-01', km, type],
    );

  it('ignores events outside the prelims and the final, and events with no place', () => {
    add('event', 4.4, 'crash');
    add('season', 4.6, 'crash');
    add('final', null, 'crash');
    expect(courseMap(busy, 1)!.markers).toEqual([]);
  });

  it('puts an event past the end of the lap on the end, and one before the start on the start', () => {
    add('final', 999, 'crash');
    add('final', -4, 'spin');
    const km = courseMap(busy, 1)!.markers.map((m) => m.km);
    expect(km).toEqual([0, lap]);
    busy.run('DELETE FROM event_log WHERE km = 999 OR km = -4');
  });

  it('keeps exactly 60 marks, spread over the whole lap, with the first and the last', () => {
    for (let i = 0; i < 100; i++) add('prelim', i * 0.5);
    add('final', lap - 0.1, 'crash');
    const marks = courseMap(busy, 1)!.markers;
    expect(marks).toHaveLength(60);
    expect(marks[0]!.km).toBe(0);
    expect(marks[59]!.km).toBe(lap - 0.1);
    expect(marks[59]!.kind).toBe('crash');
    expect(marks.map((m) => m.km)).toEqual([...marks.map((m) => m.km)].sort((a, b) => a - b));
    expect(marks.filter((m) => m.km > 25).length).toBeGreaterThan(10);
  });
});
