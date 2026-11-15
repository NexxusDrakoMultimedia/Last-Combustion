// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
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
