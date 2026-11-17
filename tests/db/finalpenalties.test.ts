// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { fitPart, scrutineerCar } from '../../src/db/upgrades';
import { persistWorld } from '../../src/db/world';
import { penaltyPlaces, technicalPenalty, type PenaltyLevel } from '../../src/sim/penalties';
import { parts } from '../../src/sim/upgrades';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

/** A career with its prelims run, and the finalist that took fifth on the grid, with its car and garage. */
function atTheFinal(seed: string) {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  db.run('UPDATE garage SET cash = 100000000');
  playPrelims(db, 1);
  const row = db.exec(
    `SELECT e.id, e.car_id, e.garage_id FROM result r JOIN entry e ON e.id = r.entry_id
      WHERE r.prelim_pos = 5`,
  )[0]!.values[0]!;
  return { db, entry: row[0] as number, car: row[1] as number, garage: row[2] as number };
}

const resultOf = (db: Database, entry: number) =>
  db.exec(`SELECT final_pos, points, prize, dnf_reason FROM result WHERE entry_id = ${entry}`)[0]!
    .values[0]!;

describe('penalties in a final, written to the results', () => {
  it('drop a car just over the road-legality limit the places its Technical penalty is worth, and no more', () => {
    const plain = atTheFinal('final-db-penalty');
    playFinal(plain.db, 1);
    const before = resultOf(plain.db, plain.entry);

    const wide = atTheFinal('final-db-penalty');
    // Fit race parts until the car is just over the road-legality limit.
    let short = 0;
    for (const p of parts.filter((x) => x.grade === 'race')) {
      fitPart(wide.db, wide.garage, wide.car, p.id);
      short = scrutineerCar(wide.db, wide.car).legalityShort;
      if (short > 0) break;
    }
    const level = technicalPenalty(0, short);
    expect(level).not.toBeNull();
    expect(level).not.toBe('palpably_unfair');
    const summary = playFinal(wide.db, 1);
    expect(
      summary.penalties.filter((p) => p.type === 'technical' && p.entryId === wide.entry),
    ).toMatchObject([{ level, places: penaltyPlaces(level as PenaltyLevel), banRaces: null }]);
    const after = resultOf(wide.db, wide.entry);
    if (before[3] === null) {
      expect(Number(after[0])).toBeGreaterThanOrEqual(Number(before[0]));
      expect(Number(after[0])).toBeLessThanOrEqual(Number(before[0]) + 5);
    }
  }, 180_000);

  it('disqualify an obviously illegal car with a Palpably Unfair Act: last, no points, no prize', () => {
    const cheat = atTheFinal('final-db-unfair');
    for (const p of parts.filter((x) => x.grade === 'race'))
      fitPart(cheat.db, cheat.garage, cheat.car, p.id);
    const summary = playFinal(cheat.db, 1);
    expect(
      summary.penalties.filter((p) => p.type === 'technical' && p.entryId === cheat.entry),
    ).toMatchObject([{ level: 'palpably_unfair', places: null }]);
    const row = resultOf(cheat.db, cheat.entry);
    expect(row[3]).toBe('disqualified');
    expect(row[1]).toBe(0);
    expect(row[2]).toBe(0);
    expect(Number(row[0])).toBe(15);
  }, 180_000);
});
