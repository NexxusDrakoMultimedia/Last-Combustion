// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { moveDateTo } from '../../src/db/calendar';
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
  // The season opening is on from 31 March; the tests start there unless they say otherwise.
  db.run("UPDATE career SET game_date = '2031-03-31'");
  return { db, id };
}

describe('conversations the player missed', () => {
  it('are held by themselves once the occasion has ended, and only once', () => {
    const { db, id } = world('social-auto');
    // The season opening runs 31 March to 2 April. Talk once, then let it end.
    converse(db, id, null, 'warm');
    moveDateTo(db, '2031-04-02');
    expect(socialView(db, id).history.filter((h) => h.auto)).toHaveLength(0);
    moveDateTo(db, '2031-04-03');
    const auto = socialView(db, id).history.filter((h) => h.auto);
    expect(auto).toHaveLength(2);
    expect(auto.every((h) => h.occasion === 'season_opening' && h.date === '2031-04-02')).toBe(
      true,
    );
    moveDateTo(db, '2031-04-10');
    expect(socialView(db, id).history.filter((h) => h.auto)).toHaveLength(2);
  });

  it('are the same however the days are skipped, and leave an occasion that was fully used alone', () => {
    const run = (steps: string[]) => {
      const { db, id } = world('social-auto-same');
      for (const to of steps) moveDateTo(db, to);
      return socialView(db, id).history.map((h) => [h.occasion, h.party.id, h.manner, h.delta]);
    };
    expect(run(['2031-04-05'])).toEqual(run(['2031-04-01', '2031-04-03', '2031-04-05']));
    const { db, id } = world('social-auto-used');
    for (const m of ['warm', 'direct', 'bold'] as const) converse(db, id, null, m);
    moveDateTo(db, '2031-04-05');
    expect(socialView(db, id).history.filter((h) => h.auto)).toHaveLength(0);
  });
});

describe('social occasions in the database', () => {
  it('opens the season opening on 31 March, with three conversations, and says what is next before it', () => {
    const { db, id } = world('social-open');
    db.run("UPDATE career SET game_date = '2031-02-01'");
    const before = socialView(db, id);
    expect(before.occasion).toBeNull();
    expect(before.next).toEqual({ id: 'season_opening', date: '2031-03-31' });
    expect(() => converse(db, id, null, 'warm')).toThrow(/no social occasion/);
    db.run("UPDATE career SET game_date = '2031-03-31'");
    const v = socialView(db, id);
    expect(v.occasion).toBe('season_opening');
    expect(v.until).toBe('2031-04-02');
    expect([v.left, v.total]).toEqual([3, 3]);
    expect(v.strangers).toBeGreaterThan(0);
  });

  it('closes between occasions and reopens on the next one’s date', () => {
    const { db, id } = world('social-close');
    db.run("UPDATE career SET game_date = '2031-04-03'");
    const between = socialView(db, id);
    expect(between.occasion).toBeNull();
    expect(between.next?.id).toBe('sponsor_dinner');
    db.run('UPDATE career SET game_date = ?', [between.next!.date]);
    expect(socialView(db, id).occasion).toBe('sponsor_dinner');
    expect(() => converse(db, id, null, 'warm')).not.toThrow();
    // It stays open for its days, and the conversations are used up per occasion.
    expect(socialView(db, id).left).toBe(2);
    db.run("UPDATE career SET game_date = '2031-03-31'");
    expect(socialView(db, id).left).toBe(3);
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
