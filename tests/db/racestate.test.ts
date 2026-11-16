// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal, startFinal, stepFinal } from '../../src/db/final';
import { playPrelimDay, playPrelims, startPrelims } from '../../src/db/prelims';
import { raceUnderWay } from '../../src/db/racestate';
import { createNewDatabase, packDatabase, unpackDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function newCareer(seed: string): Database {
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

/** What a round of prelims leaves in the database. */
const written = (db: Database) => ({
  results: db.exec(
    'SELECT entry_id, run_day, run_slot, prelim_time_ms, prelim_pos, points, pole, dnf_reason FROM result ORDER BY entry_id',
  ),
  events: db.exec(
    'SELECT scope, occurred_on, km, type, entry_id, payload FROM event_log ORDER BY id',
  ),
  cars: db.exec('SELECT id, race_km, wear FROM car ORDER BY id'),
  round: db.exec('SELECT number, status, final_date, weather_log FROM round ORDER BY number'),
});

async function saveAndLoad(db: Database): Promise<Database> {
  return (await unpackDatabase(SQL, await packDatabase(db, 'mid-race'))).db;
}

describe('the prelims of a round, a day at a time', () => {
  it('start with nothing written, and are under way until the seventh day', () => {
    const db = newCareer('race-state-a');
    expect(raceUnderWay(db)).toBeNull();
    const started = startPrelims(db, 1);
    expect(started).toEqual({ roundNumber: 1, daysPlayed: 0, summary: null });
    expect(scalar(db, 'SELECT COUNT(*) FROM race_state')).toBe(1);
    expect(scalar(db, 'SELECT COUNT(*) FROM result')).toBe(0);
    expect(scalar(db, 'SELECT status FROM round WHERE number = 1')).toBe('scheduled');
    for (let day = 1; day <= 6; day++) {
      const progress = playPrelimDay(db, 1);
      expect(progress).toEqual({ roundNumber: 1, daysPlayed: day, summary: null });
      expect(raceUnderWay(db)).toEqual({ roundNumber: 1, kind: 'prelims', progress: day });
      expect(scalar(db, 'SELECT COUNT(*) FROM result')).toBe(0);
    }
    const last = playPrelimDay(db, 1);
    expect(last.daysPlayed).toBe(7);
    expect(last.summary?.qualifiers).toBe(15);
    expect(scalar(db, 'SELECT COUNT(*) FROM race_state')).toBe(0);
    expect(scalar(db, 'SELECT COUNT(*) FROM result')).toBe(313);
    expect(scalar(db, 'SELECT status FROM round WHERE number = 1')).toBe('prelims_done');
    expect(raceUnderWay(db)).toBeNull();
  });

  it('write exactly what playing the round in one go writes, even when saved and loaded after every day', async () => {
    const whole = newCareer('race-state-b');
    const wholeSummary = playPrelims(whole, 1);
    let db = newCareer('race-state-b');
    startPrelims(db, 1);
    let summary = null;
    for (let day = 1; day <= 7; day++) {
      db = await saveAndLoad(db);
      const progress = playPrelimDay(db, 1);
      summary = progress.summary;
    }
    expect(summary).toEqual(wholeSummary);
    expect(written(db)).toEqual(written(whole));
  }, 60_000);

  it('are not changed by what the player does between days', () => {
    const whole = newCareer('race-state-c');
    playPrelims(whole, 1);
    const db = newCareer('race-state-c');
    startPrelims(db, 1);
    playPrelimDay(db, 1);
    playPrelimDay(db, 1);
    // A car is worn out and a driver's pace changes while the round is under way.
    db.run('UPDATE car SET wear = 95 WHERE id IN (SELECT car_id FROM entry LIMIT 40)');
    db.run('UPDATE driver SET pace = 99 WHERE id IN (SELECT driver_id FROM entry LIMIT 40)');
    let summary = null;
    for (let day = 3; day <= 7; day++) summary = playPrelimDay(db, 1).summary;
    expect(summary).not.toBeNull();
    expect(
      db.exec('SELECT entry_id, prelim_time_ms, prelim_pos FROM result ORDER BY entry_id'),
    ).toEqual(
      whole.exec('SELECT entry_id, prelim_time_ms, prelim_pos FROM result ORDER BY entry_id'),
    );
  }, 60_000);

  it('carry on from where they stood when played in one go, and refuse nonsense', () => {
    const whole = newCareer('race-state-d');
    const wholeSummary = playPrelims(whole, 1);
    const db = newCareer('race-state-d');
    expect(() => playPrelimDay(db, 1)).toThrow(/have not been started/);
    startPrelims(db, 1);
    playPrelimDay(db, 1);
    playPrelimDay(db, 1);
    expect(() => startPrelims(db, 1)).toThrow(/already under way/);
    expect(playPrelims(db, 1)).toEqual(wholeSummary);
    expect(() => playPrelimDay(db, 99)).toThrow(/no round/);
    expect(() => startPrelims(db, 1)).toThrow(/already been run/);
  }, 60_000);
});

/** What a final leaves in the database, over and above what the prelims left. */
const finalWritten = (db: Database) => ({
  results: db.exec(
    'SELECT entry_id, final_pos, final_time_ms, points, prize, dnf_reason, tyre_pct_at_flag FROM result ORDER BY entry_id',
  ),
  events: db.exec(
    'SELECT scope, occurred_on, km, type, entry_id, payload FROM event_log ORDER BY id',
  ),
  timing: db.exec(
    'SELECT entry_id, lap, sector, exit_seconds, tyre_pct, position FROM timing ORDER BY id',
  ),
  money: db.exec('SELECT garage_id, date, category, amount, note FROM ledger ORDER BY id'),
  garages: db.exec('SELECT id, cash, prestige, fans FROM garage ORDER BY id'),
  cars: db.exec('SELECT id, race_km, wear FROM car ORDER BY id'),
  drivers: db.exec('SELECT id, gold_border_year, fans, fame FROM driver ORDER BY id'),
  trophies: db.exec('SELECT owner_type, owner_id, kind, round_id FROM trophy ORDER BY id'),
  round: db.exec('SELECT number, status FROM round ORDER BY number'),
});

const withPrelims = (seed: string): Database => {
  const db = newCareer(seed);
  playPrelims(db, 1);
  return db;
};

describe('the final of a round, a few sectors at a time', () => {
  it('starts with nothing written, and is under way until the flag', () => {
    const db = withPrelims('race-state-final-a');
    const before = scalar(db, 'SELECT COUNT(*) FROM timing');
    const started = startFinal(db, 1);
    expect(started.sectorsRun).toBe(0);
    expect(started.summary).toBeNull();
    expect(raceUnderWay(db)).toEqual({ roundNumber: 1, kind: 'final', progress: 0 });
    expect(scalar(db, 'SELECT COUNT(*) FROM race_state')).toBe(1);
    expect(scalar(db, 'SELECT status FROM round WHERE number = 1')).toBe('prelims_done');
    expect(scalar(db, 'SELECT COUNT(*) FROM timing')).toBe(before);
    const step = stepFinal(db, 1, 10);
    expect(step.sectorsRun).toBe(10);
    expect(raceUnderWay(db)).toEqual({ roundNumber: 1, kind: 'final', progress: 10 });
    let progress = step;
    while (!progress.summary) progress = stepFinal(db, 1, 25);
    expect(progress.sectorsRun).toBeGreaterThanOrEqual(1);
    expect(progress.summary.finishers).toBeGreaterThan(0);
    expect(scalar(db, 'SELECT COUNT(*) FROM race_state')).toBe(0);
    expect(scalar(db, 'SELECT status FROM round WHERE number = 1')).toBe('complete');
  }, 60_000);

  it('write exactly what playing the final in one go writes, even when saved and loaded between steps', async () => {
    const whole = withPrelims('race-state-final-b');
    const wholeSummary = playFinal(whole, 1);
    let db = withPrelims('race-state-final-b');
    startFinal(db, 1);
    let progress = stepFinal(db, 1, 7);
    while (!progress.summary) {
      db = await saveAndLoad(db);
      progress = stepFinal(db, 1, 19);
    }
    expect(progress.summary).toEqual(wholeSummary);
    expect(finalWritten(db)).toEqual(finalWritten(whole));
  }, 120_000);

  it('are not changed by what the player does between steps', () => {
    const whole = withPrelims('race-state-final-c');
    playFinal(whole, 1);
    const db = withPrelims('race-state-final-c');
    startFinal(db, 1);
    stepFinal(db, 1, 30);
    db.run('UPDATE car SET wear = 95 WHERE id IN (SELECT car_id FROM entry LIMIT 40)');
    db.run('UPDATE driver SET racecraft = 99 WHERE id IN (SELECT driver_id FROM entry LIMIT 40)');
    let progress = stepFinal(db, 1, 1);
    while (!progress.summary) progress = stepFinal(db, 1, 50);
    expect(
      db.exec('SELECT entry_id, final_pos, final_time_ms FROM result ORDER BY entry_id'),
    ).toEqual(
      whole.exec('SELECT entry_id, final_pos, final_time_ms FROM result ORDER BY entry_id'),
    );
  }, 120_000);

  it('carry on when played in one go, take calls on the way, and refuse nonsense', () => {
    const whole = withPrelims('race-state-final-d');
    const wholeSummary = playFinal(whole, 1);
    const db = withPrelims('race-state-final-d');
    expect(() => stepFinal(db, 1)).toThrow(/has not been started/);
    expect(() => startFinal(newCareer('race-state-final-e'), 1)).toThrow(
      /prelims .* have not been run/,
    );
    startFinal(db, 1);
    stepFinal(db, 1, 12);
    expect(() => startFinal(db, 1)).toThrow(/already under way/);
    expect(() => stepFinal(db, 1, 0)).toThrow(/one sector or more/);
    expect(playFinal(db, 1)).toEqual(wholeSummary);
    expect(() => stepFinal(db, 1)).toThrow(/has not been started/);
    expect(() => startFinal(db, 1)).toThrow(/already been run/);
  }, 120_000);

  it('use the calls given when the final is started, and calls given on a final under way', async () => {
    const seed = 'race-state-final-f';
    const plain = withPrelims(seed);
    const plainSummary = playFinal(plain, 1);
    const lead = Number(scalar(plain, 'SELECT entry_id FROM result WHERE prelim_pos = 1'));
    const push = { calls: new Map([[lead, 'push' as const]]) };

    // Calls given at the start, played in steps with a save in between, equal the same calls in one go.
    const oneGo = withPrelims(seed);
    const oneGoSummary = playFinal(oneGo, 1, push);
    let stepped = withPrelims(seed);
    startFinal(stepped, 1, push);
    let progress = stepFinal(stepped, 1, 8);
    while (!progress.summary) {
      stepped = await saveAndLoad(stepped);
      progress = stepFinal(stepped, 1, 40);
    }
    expect(progress.summary).toEqual(oneGoSummary);
    expect(finalWritten(stepped)).toEqual(finalWritten(oneGo));
    // The call mattered: the lead's time is not the one it had on the computer's calls.
    const time = (db: Database) =>
      scalar(db, `SELECT final_time_ms FROM result WHERE entry_id = ${lead}`);
    expect(time(oneGo)).not.toBe(time(plain));
    expect(plainSummary.finishers).toBeGreaterThan(0);

    // Calls given on a final already under way are set on it, and the same sequence gives the same race.
    const later = (): Database => {
      const db = withPrelims(seed);
      startFinal(db, 1);
      stepFinal(db, 1, 5);
      playFinal(db, 1, push);
      return db;
    };
    expect(finalWritten(later())).toEqual(finalWritten(later()));
    expect(time(later())).not.toBe(time(plain));
  }, 180_000);
});
