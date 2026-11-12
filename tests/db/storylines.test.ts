// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { relationshipScore } from '../../src/db/negotiation';
import { foundPlayerGarage, type OwnerSetup } from '../../src/db/player';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { answerCard, liveStoryCount, storyBoard, updateStorylines } from '../../src/db/storylines';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const OWNER: OwnerSetup = {
  ownerName: 'Test Owner',
  identity: 'masculine',
  birthDate: '1990-06-01',
  garageName: 'Story Test Racing',
  flag: 'AU',
  primaryColour: '#112233',
  secondaryColour: '#ddeeff',
};

const rows = (db: Database, sql: string): unknown[][] => db.exec(sql)[0]?.values ?? [];
const one = (db: Database, sql: string) => rows(db, sql)[0]?.[0];

/** A world with the first rounds played (prelims and final). */
function playedWorld(seed: string, rounds: number): Database {
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

const roundId = (db: Database, n: number) =>
  Number(one(db, `SELECT id FROM round WHERE number = ${n} ORDER BY id LIMIT 1`));

/** Drivers classified in the finals of every one of the given rounds, lowest id first. */
function finalistsOf(db: Database, rounds: number[]): number[] {
  const sets = rounds.map(
    (n) =>
      new Set(
        rows(
          db,
          `SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id
            WHERE r.round_id = ${roundId(db, n)} AND r.final_pos IS NOT NULL`,
        ).map((r) => r[0] as number),
      ),
  );
  return [...sets[0]!].filter((d) => sets.every((s) => s.has(d))).sort((a, b) => a - b);
}

/** Clears every rivalry and storyline so a test sets the scene itself. */
const clear = (db: Database) =>
  db.exec(`DELETE FROM event_card; DELETE FROM storyline_beat; DELETE FROM storyline;
    DELETE FROM rivalry_meeting; DELETE FROM rivalry;
    DELETE FROM event_log WHERE type IN ('rivalry_update', 'storyline_update', 'story')`);

const feud = (db: Database, x: number, y: number, level = 'feud', live = 1) =>
  db.run(
    `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
     VALUES (?, ?, 95, 95, ?, ?, 2031)`,
    [Math.min(x, y), Math.max(x, y), level, live],
  );

/** Puts a driver under contract with the player's garage (made if there is none yet). */
function signForPlayer(db: Database, driverId: number): void {
  const garage =
    (one(db, 'SELECT id FROM garage WHERE is_player = 1') as number | undefined) ??
    foundPlayerGarage(db, OWNER);
  db.run(
    'INSERT INTO contract (driver_id, garage_id, start_year, end_year, salary, role, release_fee) VALUES (?, ?, 2031, 2033, 1000, ?, 0)',
    [driverId, garage, 'lead'],
  );
}

const count = (db: Database, sql: string) => Number(one(db, sql));

describe('storyline tables', () => {
  it('exist, keep the lower driver id first and allow one storyline for a rivalry', () => {
    const db = createNewDatabase(SQL);
    const names = rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r[0]);
    expect(names).toEqual(expect.arrayContaining(['storyline', 'storyline_beat', 'event_card']));
  });
});

describe('a rivalry feud storyline', () => {
  // Rounds 1 to 4 are played, and the two drivers are in the final of rounds 2 and 3.
  let db: Database;
  let x: number, y: number, r2: number, r3: number, r4: number;
  beforeAll(() => {
    db = playedWorld('story-feud', 4);
    [x, y] = finalistsOf(db, [2, 3]) as [number, number];
    r2 = roundId(db, 2);
    r3 = roundId(db, 3);
    r4 = roundId(db, 4);
  }, 300_000);

  it('has two drivers who raced the same finals to work with', () => {
    expect(x).toBeDefined();
    expect(y).toBeDefined();
  });

  it('starts when a rivalry is a Feud, with the build-up played and a card for the player driver', () => {
    clear(db);
    signForPlayer(db, x);
    feud(db, x, y);
    updateStorylines(db, r2);
    expect(rows(db, 'SELECT template, step, status, highlighted FROM storyline')).toEqual([
      ['rivalry_feud', 1, 'open', 1],
    ]);
    expect(rows(db, 'SELECT beat FROM storyline_beat')).toEqual([['build_up']]);
    expect(count(db, "SELECT COUNT(*) FROM event_log WHERE type = 'story'")).toBe(1);
    expect(rows(db, 'SELECT beat, driver_id, status FROM event_card')).toEqual([
      ['build_up', x, 'pending'],
    ]);
    expect(liveStoryCount(db)).toBe(1);
  });

  it('changes nothing when the same round is run again', () => {
    const before = JSON.stringify([
      rows(db, 'SELECT * FROM storyline'),
      rows(db, 'SELECT * FROM storyline_beat'),
      rows(db, 'SELECT * FROM event_card'),
      rows(db, "SELECT * FROM event_log WHERE type = 'story'"),
    ]);
    updateStorylines(db, r2);
    expect(
      JSON.stringify([
        rows(db, 'SELECT * FROM storyline'),
        rows(db, 'SELECT * FROM storyline_beat'),
        rows(db, 'SELECT * FROM event_card'),
        rows(db, "SELECT * FROM event_log WHERE type = 'story'"),
      ]),
    ).toBe(before);
  });

  it('plays the showdown when both race a final, and expires the card nobody answered', () => {
    updateStorylines(db, r3);
    expect(rows(db, 'SELECT step, status FROM storyline')).toEqual([[2, 'open']]);
    expect(rows(db, 'SELECT beat FROM storyline_beat ORDER BY step')).toEqual([
      ['build_up'],
      ['showdown'],
    ]);
    expect(rows(db, 'SELECT status FROM event_card')).toEqual([['expired']]);
  });

  it('plays the aftermath the round after, with a card, and then completes', () => {
    updateStorylines(db, r4);
    expect(rows(db, 'SELECT step, status FROM storyline')).toEqual([[3, 'complete']]);
    expect(rows(db, "SELECT beat, status FROM event_card WHERE beat = 'aftermath'")).toEqual([
      ['aftermath', 'pending'],
    ]);
    expect(count(db, 'SELECT COUNT(*) FROM storyline_beat')).toBe(3);
  });

  it('plays only one beat for a storyline in a round', () => {
    clear(db);
    feud(db, x, y);
    updateStorylines(db, r3);
    expect(count(db, 'SELECT COUNT(*) FROM storyline_beat')).toBe(1);
  });
});

describe('storylines that do not start or that end', () => {
  let db: Database;
  let x: number, y: number, r2: number, r3: number;
  beforeAll(() => {
    db = playedWorld('story-quiet', 3);
    [x, y] = finalistsOf(db, [2, 3]) as [number, number];
    r2 = roundId(db, 2);
    r3 = roundId(db, 3);
  }, 300_000);

  it('do not start for a rivalry below Feud, or one that is not live', () => {
    clear(db);
    feud(db, x, y, 'rivalry');
    updateStorylines(db, r2);
    expect(count(db, 'SELECT COUNT(*) FROM storyline')).toBe(0);
    clear(db);
    feud(db, x, y, 'feud', 0);
    updateStorylines(db, r2);
    expect(count(db, 'SELECT COUNT(*) FROM storyline')).toBe(0);
  });

  it('end when the rivalry is over before the showdown, and leave no card pending', () => {
    clear(db);
    signForPlayer(db, x);
    feud(db, x, y);
    updateStorylines(db, r2);
    db.run("UPDATE rivalry SET ended_year = 2031, end_reason = 'cooled'");
    // Neither driver is in the next final.
    db.run(
      'UPDATE result SET final_pos = NULL WHERE round_id = ? AND entry_id IN (SELECT id FROM entry WHERE driver_id = ?)',
      [r3, x],
    );
    updateStorylines(db, r3);
    expect(rows(db, 'SELECT status FROM storyline')).toEqual([['ended']]);
    expect(count(db, "SELECT COUNT(*) FROM event_card WHERE status = 'pending'")).toBe(0);
    expect(liveStoryCount(db)).toBe(0);
  });

  it('run with no card when both drivers are in computer garages', () => {
    clear(db);
    db.run('DELETE FROM contract WHERE garage_id IN (SELECT id FROM garage WHERE is_player = 1)');
    feud(db, x, y);
    updateStorylines(db, r2);
    expect(rows(db, 'SELECT step, highlighted FROM storyline')).toEqual([[1, 0]]);
    expect(count(db, 'SELECT COUNT(*) FROM event_card')).toBe(0);
    expect(count(db, "SELECT COUNT(*) FROM event_log WHERE type = 'story'")).toBe(1);
  });
});

describe('the highlight cap', () => {
  it('gives cards to at most three storylines at a time', () => {
    const db = playedWorld('story-cap', 2);
    const r2 = roundId(db, 2);
    clear(db);
    const [mine, a, b, c, d] = finalistsOf(db, [2]).slice(0, 5) as number[];
    signForPlayer(db, mine!);
    for (const other of [a!, b!, c!, d!]) feud(db, mine!, other);
    updateStorylines(db, r2);
    expect(count(db, 'SELECT COUNT(*) FROM storyline')).toBe(4);
    expect(count(db, 'SELECT COUNT(*) FROM storyline WHERE highlighted = 1')).toBe(3);
    expect(count(db, 'SELECT COUNT(*) FROM event_card')).toBe(3);
  });
});

describe('answering a card', () => {
  const setup = (seed: string) => {
    const db = playedWorld(seed, 2);
    const [x, y] = finalistsOf(db, [2]) as [number, number];
    clear(db);
    signForPlayer(db, x);
    feud(db, x, y);
    updateStorylines(db, roundId(db, 2));
    const cardId = Number(one(db, 'SELECT id FROM event_card'));
    return { db, x, y, cardId };
  };

  it('applies the effects of the choice: fans, reputation', () => {
    const { db, x, cardId } = setup('story-answer-a');
    const fans = Number(one(db, `SELECT fans FROM driver WHERE id = ${x}`));
    const audience = Number(one(db, 'SELECT series_fans FROM season ORDER BY year DESC LIMIT 1'));
    db.run('UPDATE driver SET reputation = 50 WHERE id = ?', [x]);
    answerCard(db, cardId, 'fuel');
    expect(Number(one(db, `SELECT fans FROM driver WHERE id = ${x}`))).toBe(
      fans + Math.round(audience * 0.004),
    );
    expect(Number(one(db, `SELECT reputation FROM driver WHERE id = ${x}`))).toBe(48);
    expect(rows(db, 'SELECT status, choice FROM event_card')).toEqual([['answered', 'fuel']]);
  });

  it('moves the relationship between the two drivers', () => {
    const { db, x, y } = setup('story-answer-b');
    db.run("UPDATE event_card SET beat = 'aftermath'");
    const id = Number(one(db, 'SELECT id FROM event_card'));
    answerCard(db, id, 'handshake');
    const a = { type: 'driver', id: Math.min(x, y) };
    const b = { type: 'driver', id: Math.max(x, y) };
    expect(relationshipScore(db, a, b)).toBe(10);
  });

  it('refuses a second answer, an expired card and a choice the card does not offer', () => {
    const { db, cardId } = setup('story-answer-c');
    expect(() => answerCard(db, cardId, 'no_such_choice')).toThrow();
    answerCard(db, cardId, 'high_road');
    expect(() => answerCard(db, cardId, 'fuel')).toThrow();
    expect(rows(db, 'SELECT choice FROM event_card')).toEqual([['high_road']]);
    db.run("UPDATE event_card SET status = 'expired', choice = NULL");
    expect(() => answerCard(db, cardId, 'fuel')).toThrow();
    expect(() => answerCard(db, 99_999, 'fuel')).toThrow();
  });

  it('gives no fans past the cap', () => {
    const { db, x, cardId } = setup('story-answer-d');
    const audience = Number(one(db, 'SELECT series_fans FROM season ORDER BY year DESC LIMIT 1'));
    const cap = Math.round(audience * 0.4);
    db.run('UPDATE driver SET fans = ? WHERE id = ?', [cap, x]);
    answerCard(db, cardId, 'fuel');
    expect(Number(one(db, `SELECT fans FROM driver WHERE id = ${x}`))).toBe(cap);
  });
});

describe('the story board', () => {
  it('lists the pending cards, with their choices, and the live storylines of the player drivers', () => {
    const db = playedWorld('story-board', 2);
    const [x, y] = finalistsOf(db, [2]) as [number, number];
    clear(db);
    signForPlayer(db, x);
    feud(db, x, y);
    updateStorylines(db, roundId(db, 2));
    const board = storyBoard(db);
    expect(board.cards).toHaveLength(1);
    expect(board.cards[0]).toMatchObject({
      template: 'rivalry_feud',
      beat: 'build_up',
      driverId: x,
      rivalId: y,
      choices: ['fuel', 'high_road'],
    });
    expect(board.stories).toHaveLength(1);
    expect(board.stories[0]).toMatchObject({ template: 'rivalry_feud', step: 1, beats: 3 });
    answerCard(db, board.cards[0]!.id, 'fuel');
    expect(storyBoard(db).cards).toHaveLength(0);
  });
});

describe('a played final', () => {
  it('starts a storyline for a rivalry that is a Feud after the round, and survives a rerun', () => {
    const db = playedWorld('story-final', 2);
    clear(db);
    const [x, y] = finalistsOf(db, [2]) as [number, number];
    // Heat 100 cools by a tenth to 90 in the round, which is still a Feud.
    db.run(
      `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
       VALUES (?, ?, 100, 100, 'feud', 1, 2031)`,
      [Math.min(x, y), Math.max(x, y)],
    );
    playPrelims(db, 3);
    playFinal(db, 3);
    expect(count(db, 'SELECT COUNT(*) FROM storyline')).toBe(1);
    expect(count(db, "SELECT COUNT(*) FROM event_log WHERE type = 'storyline_update'")).toBe(1);
  }, 300_000);
});
