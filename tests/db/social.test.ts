// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { contactsBook } from '../../src/db/contacts';
import { ensureCapTables } from '../../src/db/equity';
import { adjustRelationship } from '../../src/db/negotiation';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { createNewDatabase } from '../../src/db/session';
import { converse, socialView } from '../../src/db/social';
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
  garageName: 'Social Test Racing',
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

describe('social occasions in the database', () => {
  it('opens the season opening before the first round, with three conversations', () => {
    const { db, id } = world('social-open');
    const v = socialView(db, id);
    expect(v.occasion).toBe('season_opening');
    expect([v.left, v.total]).toEqual([3, 3]);
    expect(v.strangers).toBeGreaterThan(0);
  });

  it('closes between occasions and reopens at the next', () => {
    const { db, id } = world('social-close');
    db.run("UPDATE round SET status = 'complete' WHERE number = 1");
    expect(socialView(db, id).occasion).toBeNull();
    db.run("UPDATE round SET status = 'complete' WHERE number = 2");
    expect(socialView(db, id).occasion).toBe('sponsor_dinner');
    expect(() => converse(db, id, null, 'warm')).not.toThrow();
    db.run("UPDATE round SET status = 'complete' WHERE number = 1");
    db.run("UPDATE round SET status = 'scheduled' WHERE number = 2");
    expect(() => converse(db, id, null, 'warm')).toThrow(/no social occasion/);
  });

  it('meets someone new, who joins the contacts book', () => {
    const { db, id } = world('social-meet');
    expect(contactsBook(db, id)).toEqual([]);
    const line = converse(db, id, null, 'warm');
    expect(line.met).toBe(true);
    const book = contactsBook(db, id);
    expect(book).toHaveLength(1);
    expect(book[0]!.name).toBe(line.party.name);
    expect(book[0]!.score).toBe(line.delta + 5);
    expect(socialView(db, id).left).toBe(2);
  });

  it('moves a relationship the garage already has, and spends the budget', () => {
    const { db, id } = world('social-known');
    const sponsor = db.exec('SELECT id FROM sponsor ORDER BY id LIMIT 1')[0]!
      .values[0]![0] as number;
    adjustRelationship(db, { type: 'garage', id }, { type: 'sponsor', id: sponsor }, 10);
    const line = converse(db, id, { type: 'sponsor', id: sponsor }, 'warm');
    expect(line.met).toBe(false);
    expect(contactsBook(db, id)[0]!.score).toBe(10 + line.delta);
    converse(db, id, { type: 'sponsor', id: sponsor }, 'warm');
    converse(db, id, { type: 'sponsor', id: sponsor }, 'warm');
    expect(() => converse(db, id, { type: 'sponsor', id: sponsor }, 'warm')).toThrow(
      /no conversations left/,
    );
    expect(socialView(db, id).history).toHaveLength(3);
  });

  it('refuses someone the garage has not dealt with, and is the same for the same seed', () => {
    const a = world('social-same');
    const b = world('social-same');
    expect(() => converse(a.db, a.id, { type: 'sponsor', id: 1 }, 'warm')).toThrow(/not someone/);
    const la = converse(a.db, a.id, null, 'bold');
    const lb = converse(b.db, b.id, null, 'bold');
    expect([la.party, la.delta, la.trouble]).toEqual([lb.party, lb.delta, lb.trouble]);
  });
});
