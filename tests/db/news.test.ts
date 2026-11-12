// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { beforeAll, describe, expect, it } from 'vitest';
import { createCareer } from '../../src/db/career';
import { playFinal } from '../../src/db/final';
import { applyCrashHighlights, highlightTotal, newsFeed, writeNews } from '../../src/db/news';
import { playPrelims } from '../../src/db/prelims';
import { createNewDatabase } from '../../src/db/session';
import { loadSql, type Database, type SqlJsStatic } from '../../src/db/sql';
import { persistWorld } from '../../src/db/world';
import { generateWorld } from '../../src/sim/worldgen';

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await loadSql();
});

const rows = (db: Database, sql: string): unknown[][] => db.exec(sql)[0]?.values ?? [];
const one = (db: Database, sql: string) => rows(db, sql)[0]?.[0];
const count = (db: Database, sql: string) => Number(one(db, sql));

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

/** Clears what a played round wrote, so a test sets the scene itself. */
const clear = (db: Database) =>
  db.exec(`DELETE FROM news; DELETE FROM storyline_beat; DELETE FROM event_card; DELETE FROM storyline;
    DELETE FROM rivalry_meeting; DELETE FROM rivalry;
    DELETE FROM event_log WHERE type IN ('crash', 'highlight', 'highlight_update', 'news_update',
      'storyline_update', 'story', 'rivalry_update')`);

/** Entries with different car models, whose prices a test sets (a repair bill is 3% of the price). */
function pricedEntries(db: Database, prices: number[]): { entry: number; driver: number }[] {
  const seen = new Set<number>();
  const picked = rows(
    db,
    `SELECT e.id, e.driver_id, c.car_model_id FROM entry e JOIN car c ON c.id = e.car_id
      WHERE e.series = 'main' ORDER BY e.id`,
  )
    .filter((r) => (seen.has(r[2] as number) ? false : (seen.add(r[2] as number), true)))
    .slice(0, prices.length);
  picked.forEach((r, i) =>
    db.run('UPDATE car_model SET price_new = ? WHERE id = ?', [prices[i]!, r[2] as number]),
  );
  return picked.map((r) => ({ entry: r[0] as number, driver: r[1] as number }));
}

const crash = (db: Database, round: number, scope: 'prelim' | 'final', entry: number) =>
  db.run(
    "INSERT INTO event_log (round_id, scope, occurred_on, type, entry_id) VALUES (?, ?, '2031-03-01', 'crash', ?)",
    [round, scope, entry],
  );

const audienceOf = (db: Database) =>
  Number(one(db, 'SELECT series_fans FROM season ORDER BY year DESC LIMIT 1'));

describe('the news table', () => {
  it('exists, holds one item for a kind, thing and detail in a round, and refuses a made-up kind', () => {
    const db = playedWorld('news-table', 1);
    clear(db);
    const r = roundId(db, 1);
    const add = (kind: string, ref = 0, detail = '') =>
      db.run(
        "INSERT INTO news (round_id, kind, driver_id, detail, ref_id, journalist_id, date) VALUES (?, ?, 1, ?, ?, 1, '2031-03-01')",
        [r, kind, detail, ref],
      );
    add('winner');
    expect(() => add('winner')).toThrow(/UNIQUE constraint/);
    expect(() => add('scandal')).toThrow(/CHECK constraint/);
    expect(() => add('rivalry', 4, 'close_finish')).not.toThrow();
    expect(() => add('rivalry', 4, 'title_fight')).not.toThrow();
  });
});

describe('crash highlights', () => {
  it('keeps the two dearest crashes and gives each driver fans and a reputation cost', () => {
    const db = playedWorld('news-hl', 1);
    clear(db);
    const [a, b, c] = pricedEntries(db, [1_000_000, 500_000, 100_000]) as {
      entry: number;
      driver: number;
    }[];
    const r = roundId(db, 1);
    for (const e of [a!, b!, c!]) {
      crash(db, r, 'final', e.entry);
      db.run('UPDATE driver SET fans = 1000, reputation = 50 WHERE id = ?', [e.driver]);
    }
    applyCrashHighlights(db, r);
    const gained = Math.round(audienceOf(db) * 0.0015);
    expect(
      rows(
        db,
        `SELECT json_extract(payload, '$.entry') FROM event_log WHERE type = 'highlight' ORDER BY id`,
      ),
    ).toEqual([[a!.entry], [b!.entry]]);
    for (const e of [a!, b!]) {
      expect(count(db, `SELECT fans FROM driver WHERE id = ${e.driver}`)).toBe(1000 + gained);
      expect(count(db, `SELECT reputation FROM driver WHERE id = ${e.driver}`)).toBe(48);
    }
    expect(count(db, `SELECT fans FROM driver WHERE id = ${c!.driver}`)).toBe(1000);
    expect(highlightTotal(db)).toBe(2);
  });

  it('needs a dear enough repair bill for a prelim crash', () => {
    const db = playedWorld('news-prelim', 1);
    clear(db);
    const [cheap, dear] = pricedEntries(db, [100_000, 1_000_000]) as {
      entry: number;
      driver: number;
    }[];
    const r = roundId(db, 1);
    crash(db, r, 'prelim', cheap!.entry);
    crash(db, r, 'prelim', dear!.entry);
    applyCrashHighlights(db, r);
    expect(
      rows(db, `SELECT json_extract(payload, '$.entry') FROM event_log WHERE type = 'highlight'`),
    ).toEqual([[dear!.entry]]);
  });

  it('changes nothing when the round is run again', () => {
    const db = playedWorld('news-twice', 1);
    clear(db);
    const [a] = pricedEntries(db, [1_000_000]) as { entry: number; driver: number }[];
    const r = roundId(db, 1);
    crash(db, r, 'final', a!.entry);
    applyCrashHighlights(db, r);
    const fans = count(db, `SELECT fans FROM driver WHERE id = ${a!.driver}`);
    applyCrashHighlights(db, r);
    expect(count(db, `SELECT fans FROM driver WHERE id = ${a!.driver}`)).toBe(fans);
    expect(highlightTotal(db)).toBe(1);
  });

  it('gives no fans past the cap but still costs reputation, never below zero', () => {
    const db = playedWorld('news-cap', 1);
    clear(db);
    const [a] = pricedEntries(db, [1_000_000]) as { entry: number; driver: number }[];
    const r = roundId(db, 1);
    const cap = Math.round(audienceOf(db) * 0.4);
    db.run('UPDATE driver SET fans = ?, reputation = 1 WHERE id = ?', [cap, a!.driver]);
    crash(db, r, 'final', a!.entry);
    applyCrashHighlights(db, r);
    expect(count(db, `SELECT fans FROM driver WHERE id = ${a!.driver}`)).toBe(cap);
    expect(count(db, `SELECT reputation FROM driver WHERE id = ${a!.driver}`)).toBe(0);
  });

  it('raises the driver fame along with the fans', () => {
    const db = playedWorld('news-fame', 1);
    clear(db);
    const [a] = pricedEntries(db, [1_000_000]) as { entry: number; driver: number }[];
    const r = roundId(db, 1);
    db.run('UPDATE driver SET fans = 1000, fame = 0 WHERE id = ?', [a!.driver]);
    crash(db, r, 'final', a!.entry);
    applyCrashHighlights(db, r);
    expect(count(db, `SELECT fame FROM driver WHERE id = ${a!.driver}`)).toBeGreaterThan(0);
  });
});

describe('writing the news', () => {
  it('writes the winner, the highlights, the rivalry meetings and the storyline beats', () => {
    const db = playedWorld('news-write', 1);
    clear(db);
    const r = roundId(db, 1);
    const [a] = pricedEntries(db, [1_000_000]) as { entry: number; driver: number }[];
    crash(db, r, 'final', a!.entry);
    applyCrashHighlights(db, r);
    const [x, y] = rows(db, 'SELECT id FROM driver ORDER BY id LIMIT 2').map((q) => q[0] as number);
    db.run(
      `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
       VALUES (?, ?, 95, 95, 'feud', 1, 2031)`,
      [x!, y!],
    );
    const rivalry = Number(one(db, 'SELECT id FROM rivalry'));
    db.run(
      "INSERT INTO rivalry_meeting (rivalry_id, round_id, kind, gain) VALUES (?, ?, 'close_finish', 8)",
      [rivalry, r],
    );
    db.run(
      "INSERT INTO storyline (template, rivalry_id, driver_a, driver_b, started_round_id, step) VALUES ('rivalry_feud', ?, ?, ?, ?, 1)",
      [rivalry, x!, y!, r],
    );
    db.run(
      "INSERT INTO storyline_beat (storyline_id, step, beat, round_id) VALUES ((SELECT id FROM storyline), 0, 'build_up', ?)",
      [r],
    );
    writeNews(db, r);
    expect(rows(db, 'SELECT kind, detail FROM news ORDER BY id')).toEqual([
      ['winner', ''],
      ['crash', 'final'],
      ['rivalry', 'close_finish'],
      ['story', 'rivalry_feud.build_up'],
    ]);
    const winner = one(
      db,
      `SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id WHERE r.round_id = ${r} AND r.final_pos = 1`,
    );
    expect(one(db, "SELECT driver_id FROM news WHERE kind = 'winner'")).toBe(winner);
    expect(one(db, "SELECT driver_id FROM news WHERE kind = 'crash'")).toBe(a!.driver);
    expect(rows(db, "SELECT driver_id, other_driver_id FROM news WHERE kind = 'rivalry'")).toEqual([
      [x, y],
    ]);
  });

  it('changes nothing when the round is run again', () => {
    const db = playedWorld('news-write-twice', 1);
    const r = roundId(db, 1);
    const before = JSON.stringify(rows(db, 'SELECT * FROM news'));
    expect(before).not.toBe('[]');
    writeNews(db, r);
    expect(JSON.stringify(rows(db, 'SELECT * FROM news'))).toBe(before);
  });

  it('keeps no more than the cap for a kind, the hottest rivalries first', () => {
    const db = playedWorld('news-caps', 1);
    clear(db);
    const r = roundId(db, 1);
    const ids = rows(db, 'SELECT id FROM driver ORDER BY id LIMIT 8').map((q) => q[0] as number);
    [90, 40, 70, 60].forEach((heat, i) => {
      db.run(
        `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year)
         VALUES (?, ?, ?, ?, 'rivalry', 1, 2031)`,
        [ids[i * 2]!, ids[i * 2 + 1]!, heat, heat],
      );
    });
    db.run(
      "INSERT INTO rivalry_meeting (rivalry_id, round_id, kind, gain) SELECT id, ?, 'close_finish', 8 FROM rivalry",
      [r],
    );
    writeNews(db, r);
    const heats = rows(
      db,
      "SELECT rv.heat FROM news n JOIN rivalry rv ON rv.driver_a = n.driver_id WHERE n.kind = 'rivalry' ORDER BY n.id",
    );
    expect(heats).toEqual([[90], [70]]);
  });

  it('is read newest first, with names and the journalist', () => {
    const db = playedWorld('news-feed', 2);
    const feed = newsFeed(db, 10);
    expect(feed.length).toBeGreaterThanOrEqual(2);
    expect(feed[0]!.round).toBeGreaterThanOrEqual(feed[feed.length - 1]!.round);
    expect(feed[0]!.driver.length).toBeGreaterThan(0);
    expect(feed[0]!.journalist.name.length).toBeGreaterThan(0);
    expect(newsFeed(db, 1)).toHaveLength(1);
  });
});

describe('a played final', () => {
  it('writes the round news and the highlight marker, and a rerun adds nothing', () => {
    const db = playedWorld('news-final', 1);
    expect(count(db, "SELECT COUNT(*) FROM news WHERE kind = 'winner'")).toBe(1);
    expect(count(db, "SELECT COUNT(*) FROM event_log WHERE type = 'news_update'")).toBe(1);
    expect(count(db, "SELECT COUNT(*) FROM event_log WHERE type = 'highlight_update'")).toBe(1);
  });
});
