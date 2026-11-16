// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal, startFinal, stepFinal } from '../../src/db/final';
import { playPrelims, startPrelims } from '../../src/db/prelims';
import { stepPrelims } from '../../src/db/raceday';
import { finalView, prelimView } from '../../src/db/racewatch';
import { readCareer } from '../../src/db/career';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

function fresh(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  return db;
}

function withPrelims(seed: string): Database {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  playPrelims(db, 1);
  return db;
}

const results = (db: Database) =>
  db.exec('SELECT entry_id, final_pos, final_time_ms, points FROM result ORDER BY entry_id');

describe('the timing screen of a final', () => {
  it('is nothing until the final is started, and nothing once it is over', () => {
    const db = withPrelims('race-watch-a');
    expect(finalView(db, 1)).toBeNull();
    expect(finalView(db, 99)).toBeNull();
    startFinal(db, 1);
    expect(finalView(db, 1)).not.toBeNull();
    playFinal(db, 1);
    expect(finalView(db, 1)).toBeNull();
  }, 60_000);

  it('shows the grid at the start: fifteen cars in order, full tyres and no gaps yet', () => {
    const db = withPrelims('race-watch-b');
    startFinal(db, 1);
    const v = finalView(db, 1)!;
    expect(v.progress).toBe(0);
    expect(v.lap).toBe(1);
    expect(v.sector).toBe(1);
    expect(v.laps).toBeGreaterThan(1);
    expect(v.totalSectors).toBe(v.laps * v.sectorCount);
    expect(v.rows).toHaveLength(15);
    expect(v.rows.map((r) => r.position)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(v.rows[0]!.gapSeconds).toBeNull();
    expect(v.rows[0]!.intervalSeconds).toBeNull();
    expect(v.rows.every((r) => r.tyrePct === 100 && r.retired === null && !r.mine)).toBe(true);
    expect(v.feed).toEqual([]);
    const lead = Number(
      db.exec('SELECT entry_id FROM result WHERE prelim_pos = 1')[0]!.values[0]![0],
    );
    expect(v.rows[0]!.entryId).toBe(lead);
  }, 60_000);

  it('follows the race: gaps grow down the order, tyres wear, sector times appear and the feed fills', () => {
    const db = withPrelims('race-watch-c');
    startFinal(db, 1);
    const progress = stepFinal(db, 1, 40);
    const v = finalView(db, 1)!;
    expect(v.progress).toBe(progress.sectorsRun);
    expect(v.progress).toBe(40);
    expect(v.lap).toBe(Math.floor(40 / v.sectorCount) + 1);
    expect(v.sector).toBe((40 % v.sectorCount) + 1);
    const running = v.rows.filter((r) => r.position !== null);
    const retired = v.rows.filter((r) => r.position === null);
    expect(running.length + retired.length).toBe(15);
    expect(v.rows.slice(running.length).every((r) => r.position === null)).toBe(true);
    for (let i = 1; i < running.length; i++) {
      expect(running[i]!.gapSeconds!).toBeGreaterThanOrEqual(running[i - 1]!.gapSeconds ?? 0);
      expect(running[i]!.intervalSeconds!).toBeGreaterThanOrEqual(0);
    }
    expect(running.every((r) => r.tyrePct < 100 && r.lastSectorSeconds! > 0)).toBe(true);
    expect(retired.every((r) => r.retired !== null)).toBe(true);
    expect(v.feed.length).toBeLessThanOrEqual(14);
    // Newest first.
    for (let i = 1; i < v.feed.length; i++) {
      const a = v.feed[i - 1]!;
      const b = v.feed[i]!;
      expect(a.lap * 1000 + a.sector).toBeGreaterThanOrEqual(b.lap * 1000 + b.sector);
    }
    expect(v.feed.every((l) => l.driver.length > 0 && l.raceNumber > 0)).toBe(true);
  }, 60_000);

  it('does not change by looking, and is the same after the database is saved and reopened', () => {
    const db = withPrelims('race-watch-d');
    startFinal(db, 1);
    stepFinal(db, 1, 25);
    const first = finalView(db, 1);
    expect(finalView(db, 1)).toEqual(first);
    const done = new Uint8Array(db.export());
    const reopened = new SQL.Database(done);
    expect(finalView(reopened, 1)).toEqual(first);
  }, 60_000);
});

describe('stepping a final to the next incident', () => {
  it('stops at an incident the player would want to see, and the race is the same however it is stepped', () => {
    const whole = withPrelims('race-watch-e');
    playFinal(whole, 1);
    const db = withPrelims('race-watch-e');
    startFinal(db, 1);
    let stops = 0;
    let sawIncident = false;
    let progress = stepFinal(db, 1, 10_000, { untilPause: true });
    while (!progress.summary) {
      expect(progress.paused).toBe(true);
      stops += 1;
      const v = finalView(db, 1)!;
      // The incident that stopped the race is the newest thing in the feed.
      if (v.feed.some((l) => l.sector === ((v.progress - 1) % v.sectorCount) + 1))
        sawIncident = true;
      progress = stepFinal(db, 1, 10_000, { untilPause: true });
    }
    expect(stops).toBeGreaterThan(0);
    expect(sawIncident).toBe(true);
    expect(results(db)).toEqual(results(whole));
  }, 120_000);

  it('plays to the flag when nothing stops it', () => {
    const db = withPrelims('race-watch-f');
    startFinal(db, 1);
    const progress = stepFinal(db, 1, 10_000);
    expect(progress.summary).not.toBeNull();
    expect(progress.paused).toBeUndefined();
  }, 60_000);
});

describe('the timing screen of the prelims', () => {
  it('is nothing before the prelims are started and once they are over', () => {
    const db = fresh('prelim-watch-a');
    expect(prelimView(db, 1)).toBeNull();
    expect(prelimView(db, 99)).toBeNull();
    startPrelims(db, 1);
    const v = prelimView(db, 1)!;
    expect(v.day).toBe(1);
    expect(v.daysPlayed).toBe(0);
    expect(v.totalDays).toBe(7);
    expect(v.runsPlayedToday).toBe(0);
    expect(v.runsToday).toBeGreaterThan(30);
    expect(v.runs).toBe(313);
    expect(v.standings).toEqual([]);
    expect(v.latest).toEqual([]);
    stepPrelims(db, 1, 'end');
    expect(prelimView(db, 1)).toBeNull();
  }, 60_000);

  it('fills in a run at a time: the day\u2019s runs, the classification and the incidents', () => {
    const db = fresh('prelim-watch-b');
    stepPrelims(db, 1, 'run');
    let v = prelimView(db, 1)!;
    expect(v.runsPlayedToday).toBe(1);
    expect(v.runsPlayed).toBe(1);
    expect(v.latest).toHaveLength(1);
    stepPrelims(db, 1, 'runs');
    v = prelimView(db, 1)!;
    expect(v.runsPlayedToday).toBe(11);
    expect(v.latest).toHaveLength(10);
    const timed = v.standings;
    for (let i = 1; i < timed.length; i++) {
      expect(timed[i]!.timeMs!).toBeGreaterThanOrEqual(timed[i - 1]!.timeMs!);
      expect(timed[i]!.position).toBe(i + 1);
    }
    expect(timed[0]!.gapMs).toBe(0);
    expect(timed.every((r) => r.qualifying === r.position <= v.finalSize)).toBe(true);
    expect(v.feed.length).toBeLessThanOrEqual(14);
    expect(v.feed.every((l) => l.driver.length > 0 && l.raceNumber > 0)).toBe(true);
  }, 60_000);

  it('finishes a day without going past it, on that day\u2019s date, then the next one on its own', () => {
    const db = fresh('prelim-watch-c');
    stepPrelims(db, 1, 'run');
    const first = prelimView(db, 1)!;
    stepPrelims(db, 1, 'day');
    const after = prelimView(db, 1)!;
    expect(after.daysPlayed).toBe(1);
    expect(after.day).toBe(2);
    expect(after.runsPlayedToday).toBe(0);
    expect(after.runsPlayed).toBe(first.runsToday);
    expect(readCareer(db)!.gameDate >= first.date).toBe(true);
    stepPrelims(db, 1, 'run');
    const next = prelimView(db, 1)!;
    expect(next.runsPlayedToday).toBe(1);
    expect(readCareer(db)!.gameDate >= next.date).toBe(true);
  }, 60_000);

  it('writes exactly what playing the prelims in one go writes, whatever the steps and the saves', async () => {
    const whole = fresh('prelim-watch-d');
    playPrelims(whole, 1);
    let db = fresh('prelim-watch-d');
    const rows = (d: Database) =>
      d.exec(
        'SELECT entry_id, run_day, run_slot, prelim_time_ms, prelim_pos, points, pole, dnf_reason FROM result ORDER BY entry_id',
      );
    stepPrelims(db, 1, 'run');
    stepPrelims(db, 1, 'runs');
    db = new SQL.Database(new Uint8Array(db.export()));
    stepPrelims(db, 1, 'day');
    stepPrelims(db, 1, 'runs');
    const done = stepPrelims(db, 1, 'end');
    expect(done.summary).not.toBeNull();
    expect(rows(db)).toEqual(rows(whole));
  }, 120_000);
});
