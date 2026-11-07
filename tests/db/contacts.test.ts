// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { contactsBook } from '../../src/db/contacts';
import { ensureCapTables } from '../../src/db/equity';
import { adjustRelationship } from '../../src/db/negotiation';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { createStarterOffers } from '../../src/db/starter';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const setup: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Contacts Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

function world(seed: string): { db: Database; id: number } {
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
  return { db, id };
}

describe('the contacts book', () => {
  it('is empty before the garage has dealt with anyone', () => {
    const { db, id } = world('contacts-empty');
    expect(contactsBook(db, id)).toEqual([]);
  });

  it('lists everyone dealt with, best first, with names and kinds', () => {
    const { db, id } = world('contacts-list');
    const sponsor = db.exec('SELECT id, name FROM sponsor ORDER BY id LIMIT 1')[0]!.values[0]!;
    const maker = db.exec('SELECT id, name FROM manufacturer ORDER BY id LIMIT 1')[0]!.values[0]!;
    adjustRelationship(
      db,
      { type: 'garage', id },
      { type: 'sponsor', id: sponsor[0] as number },
      60,
    );
    adjustRelationship(
      db,
      { type: 'garage', id },
      { type: 'manufacturer', id: maker[0] as number },
      -70,
    );
    adjustRelationship(db, { type: 'garage', id }, { type: 'utility', id: 1 }, 10);
    adjustRelationship(db, { type: 'garage', id }, { type: 'utility', id: 99999 }, 10);
    const book = contactsBook(db, id);
    expect(book.map((c) => [c.type, c.kind, c.score])).toEqual([
      ['sponsor', 'friend', 60],
      ['utility', 'acquaintance', 10],
      ['manufacturer', 'enemy', -70],
    ]);
    expect(book[0]!.name).toBe(sponsor[1]);
    expect(book[2]!.name).toBe(maker[1]);
    expect(book[1]!.name).toBe('Gawler Grid Power');
  });
});
