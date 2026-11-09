// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { contactsBook } from '../../src/db/contacts';
import { ensureCapTables } from '../../src/db/equity';
import { adjustRelationship } from '../../src/db/negotiation';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { pressView, writeHeadline } from '../../src/db/press';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { JOURNALISTS } from '../../src/sim/press';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Press Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const scalar = (db: Database, sql: string) => db.exec(sql)[0]?.values[0]?.[0];

/** A world where one of the season's entries races for the player and has a result in round 1. */
function world(seed: string, position: number, points: number): { db: Database; id: number } {
  const db = createNewDatabase(SQL);
  createCareer(db, {
    mode: 'garage_owner',
    masterSeed: seed,
    startYear: 2031,
    difficulty: 'standard',
  });
  persistWorld(db, generateWorld(seed));
  const id = foundPlayerGarage(db, setup);
  createStarterOffers(db);
  ensureCapTables(db);
  const entry = Number(
    scalar(db, "SELECT id FROM entry WHERE series = 'main' ORDER BY id LIMIT 1"),
  );
  db.run('UPDATE entry SET garage_id = ? WHERE id = ?', [id, entry]);
  const round = Number(scalar(db, 'SELECT id FROM round WHERE number = 1'));
  db.run('INSERT INTO result (round_id, entry_id, final_pos, points) VALUES (?, ?, ?, ?)', [
    round,
    entry,
    position,
    points,
  ]);
  return { db, id };
}

const roundOne = (db: Database) => Number(scalar(db, 'SELECT id FROM round WHERE number = 1'));

describe('headlines', () => {
  it('are written about the player’s best finish, by one of the journalists', () => {
    const { db, id } = world('press-win', 1, 25);
    const h = writeHeadline(db, roundOne(db))!;
    expect(h.kind).toBe('win');
    expect(h.tone).toBe('fair');
    // A fair view still moves the fans: a win wins some.
    expect(h.fans).toBe(60);
    expect(JOURNALISTS.map((j) => j.id)).toContain(h.journalist.id);
    expect(pressView(db, id).headlines).toHaveLength(1);
    // Being written about makes the journalist an acquaintance.
    expect(contactsBook(db, id).map((c) => c.type)).toEqual(['journalist']);
  });

  it('win fans from a warm journalist and lose them to a cold one', () => {
    for (const [score, sign] of [
      [80, 1],
      [-80, -1],
    ] as const) {
      const { db, id } = world('press-tone', 2, 18);
      for (const j of JOURNALISTS)
        adjustRelationship(db, { type: 'garage', id }, { type: 'journalist', id: j.id }, score);
      db.run('UPDATE garage SET fans = 10000 WHERE id = ?', [id]);
      const h = writeHeadline(db, roundOne(db))!;
      expect(h.tone).toBe(sign > 0 ? 'warm' : 'cold');
      expect(
        Math.sign(Number(scalar(db, `SELECT fans FROM garage WHERE id = ${id}`)) - 10000),
      ).toBe(sign);
    }
  });

  it('are the same for the same seed, and nothing is written if the garage did not race', () => {
    const a = world('press-same', 5, 6);
    const b = world('press-same', 5, 6);
    expect(writeHeadline(a.db, roundOne(a.db))!.journalist).toEqual(
      writeHeadline(b.db, roundOne(b.db))!.journalist,
    );
    const { db } = world('press-none', 5, 6);
    db.run('DELETE FROM result');
    expect(writeHeadline(db, roundOne(db))).toBeUndefined();
  });
});
