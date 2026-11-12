// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { clampReputation, highlightSlots, nextBeat, templateOf } from '../sim/storyline';
import { storylineData } from '../sim/worldgen/data';
import { all } from './entries';
import { addFans } from './fans';
import { adjustRelationship } from './negotiation';

/** One pending event card for one of the player's drivers. */
export interface StoryCard {
  id: number;
  storylineId: number;
  template: string;
  beat: string;
  driverId: number;
  driverName: string;
  rivalId: number;
  rivalName: string;
  /** The keys of the choices on offer (see `data/storylines.json`). */
  choices: string[];
}

/** A live storyline that is highlighted for the player. */
export interface StoryRow {
  id: number;
  template: string;
  driverName: string;
  rivalName: string;
  /** Beats played so far, out of `beats`. */
  step: number;
  beats: number;
}

export interface StoryBoard {
  cards: StoryCard[];
  stories: StoryRow[];
}

/** The ids of the drivers under contract with the player's garage this season or later. */
function playerDrivers(db: Database): Set<number> {
  return new Set(
    all(
      db,
      `SELECT DISTINCT c.driver_id FROM contract c JOIN garage g ON g.id = c.garage_id
        WHERE g.is_player = 1 AND c.end_year >= (SELECT MAX(year) FROM season)`,
    ).map((r) => r.driver_id as number),
  );
}

/**
 * Moves the storylines on after a round's final (see the GDD, "Storylines"): cards nobody answered
 * from earlier rounds expire, each open storyline plays its next beat if one is due (one beat a
 * round), and a rivalry that has reached Feud starts a storyline. A beat is written to the history,
 * and a storyline highlighted for the player (at most three at a time) gives the player's drivers an
 * event card. Running a round again changes nothing.
 */
export function updateStorylines(db: Database, roundId: number): void {
  if (
    all(db, "SELECT 1 FROM event_log WHERE round_id = ? AND type = 'storyline_update'", [roundId])
      .length > 0
  )
    return;
  const round = all(db, 'SELECT final_date FROM round WHERE id = ?', [roundId])[0];
  if (!round) return;
  const date = round.final_date as string;
  const mine = playerDrivers(db);

  db.run("UPDATE event_card SET status = 'expired' WHERE status = 'pending' AND round_id < ?", [
    roundId,
  ]);

  const playBeat = (
    s: { id: number; template: string; a: number; b: number; highlighted: boolean },
    index: number,
    key: string,
  ) => {
    const template = templateOf(s.template)!;
    db.run(
      "INSERT INTO event_log (round_id, scope, occurred_on, type, payload) VALUES (?, 'event', ?, 'story', ?)",
      [
        roundId,
        date,
        JSON.stringify({ storyline: s.id, template: s.template, beat: key, a: s.a, b: s.b }),
      ],
    );
    const logId = all(db, 'SELECT last_insert_rowid() AS id')[0]!.id as number;
    db.run(
      'INSERT INTO storyline_beat (storyline_id, step, beat, round_id, event_log_id) VALUES (?, ?, ?, ?, ?)',
      [s.id, index, key, roundId, logId],
    );
    const step = index + 1;
    const done = step >= template.beats.length;
    db.run('UPDATE storyline SET step = ?, status = ?, ended_round_id = ? WHERE id = ?', [
      step,
      done ? 'complete' : 'open',
      done ? roundId : null,
      s.id,
    ]);
    if (s.highlighted && template.cards[key])
      for (const driver of [s.a, s.b].filter((d) => mine.has(d)))
        db.run(
          'INSERT INTO event_card (storyline_id, beat, driver_id, round_id) VALUES (?, ?, ?, ?)',
          [s.id, key, driver, roundId],
        );
  };

  // The storylines that are already running.
  const finalists = new Set(
    all(
      db,
      `SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
        WHERE r.round_id = ? AND r.final_pos IS NOT NULL`,
      [roundId],
    ).map((r) => r.driver_id as number),
  );
  for (const r of all(
    db,
    `SELECT s.id, s.template, s.driver_a, s.driver_b, s.step, s.highlighted,
            (rv.ended_year IS NULL) AS rivalry_open
       FROM storyline s JOIN rivalry rv ON rv.id = s.rivalry_id
      WHERE s.status = 'open' ORDER BY s.id`,
  )) {
    const template = templateOf(r.template as string);
    if (!template) continue;
    const a = r.driver_a as number;
    const b = r.driver_b as number;
    const next = nextBeat(template.beats, r.step as number, {
      bothInFinal: finalists.has(a) && finalists.has(b),
      rivalryOpen: r.rivalry_open === 1,
    });
    if (next === null) continue;
    if (next.kind === 'end') {
      db.run("UPDATE storyline SET status = 'ended', ended_round_id = ? WHERE id = ?", [
        roundId,
        r.id as number,
      ]);
      continue;
    }
    playBeat(
      {
        id: r.id as number,
        template: r.template as string,
        a,
        b,
        highlighted: r.highlighted === 1,
      },
      next.index,
      next.key,
    );
  }

  // New storylines from the rivalries that have reached their trigger.
  let slots = highlightSlots(
    all(db, "SELECT COUNT(*) AS n FROM storyline WHERE status = 'open' AND highlighted = 1")[0]!
      .n as number,
  );
  for (const [name, template] of Object.entries(storylineData.templates)) {
    const levels = template.trigger.rivalryLevels;
    for (const rv of all(
      db,
      `SELECT rv.id, rv.driver_a, rv.driver_b, rv.level FROM rivalry rv
        WHERE rv.live = 1 AND rv.ended_year IS NULL
          AND NOT EXISTS (SELECT 1 FROM storyline s WHERE s.template = ? AND s.rivalry_id = rv.id)
        ORDER BY rv.id`,
      [name],
    )) {
      if (!levels.includes(rv.level as string)) continue;
      const a = rv.driver_a as number;
      const b = rv.driver_b as number;
      const highlighted = slots > 0 && (mine.has(a) || mine.has(b));
      if (highlighted) slots--;
      db.run(
        `INSERT INTO storyline (template, rivalry_id, driver_a, driver_b, started_round_id, highlighted)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, rv.id as number, a, b, roundId, highlighted ? 1 : 0],
      );
      const id = all(db, 'SELECT last_insert_rowid() AS id')[0]!.id as number;
      const first = nextBeat(templateOf(name)!.beats, 0, { bothInFinal: false, rivalryOpen: true });
      if (first?.kind === 'beat') playBeat({ id, template: name, a, b, highlighted }, 0, first.key);
    }
  }

  db.run(
    "INSERT INTO event_log (round_id, scope, occurred_on, type, payload) VALUES (?, 'season', ?, 'storyline_update', '{}')",
    [roundId, date],
  );
}

/** How many storylines are running. */
export function liveStoryCount(db: Database): number {
  return all(db, "SELECT COUNT(*) AS n FROM storyline WHERE status = 'open'")[0]!.n as number;
}

/**
 * Answers a pending card with one of its choices: the choice's fans (a share of the series
 * audience, never past the cap), reputation and relationship with the rival are applied together,
 * and the answer goes to the history. A card that is answered, expired or unknown, or a choice the
 * card does not offer, is refused with an error and nothing changes.
 */
export function answerCard(db: Database, cardId: number, choice: string): void {
  const card = all(
    db,
    `SELECT c.id, c.storyline_id, c.beat, c.driver_id, c.status, c.round_id, s.template,
            s.driver_a, s.driver_b, ro.final_date
       FROM event_card c JOIN storyline s ON s.id = c.storyline_id JOIN round ro ON ro.id = c.round_id
      WHERE c.id = ?`,
    [cardId],
  )[0];
  if (!card) throw new Error(`There is no card ${cardId}.`);
  if (card.status !== 'pending') throw new Error('That card has already been answered or expired.');
  const picked = templateOf(card.template as string)?.cards[card.beat as string]?.find(
    (c) => c.key === choice,
  );
  if (!picked) throw new Error(`The card does not offer ${choice}.`);
  const season = all(db, 'SELECT id, series_fans FROM season ORDER BY year DESC LIMIT 1')[0]!;
  const driverId = card.driver_id as number;
  const rival = (card.driver_a === driverId ? card.driver_b : card.driver_a) as number;
  db.exec('BEGIN');
  try {
    const fx = picked.effects;
    if (fx.fans)
      addFans(
        db,
        'driver',
        driverId,
        Math.round((season.series_fans as number) * fx.fans),
        season.series_fans as number,
        season.id as number,
      );
    if (fx.reputation) {
      const row = all(db, 'SELECT reputation FROM driver WHERE id = ?', [driverId])[0]!;
      db.run('UPDATE driver SET reputation = ? WHERE id = ?', [
        clampReputation(row.reputation as number, fx.reputation),
        driverId,
      ]);
    }
    if (fx.relationship)
      adjustRelationship(
        db,
        { type: 'driver', id: Math.min(driverId, rival) },
        { type: 'driver', id: Math.max(driverId, rival) },
        fx.relationship,
      );
    db.run("UPDATE event_card SET status = 'answered', choice = ? WHERE id = ?", [choice, cardId]);
    db.run(
      "INSERT INTO event_log (round_id, scope, occurred_on, type, payload) VALUES (?, 'event', ?, 'story', ?)",
      [
        card.round_id as number,
        card.final_date as string,
        JSON.stringify({
          storyline: card.storyline_id,
          template: card.template,
          beat: card.beat,
          choice,
        }),
      ],
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** The pending cards for the player's drivers, and the live storylines highlighted for them. */
export function storyBoard(db: Database): StoryBoard {
  const name = (id: number) =>
    all(db, 'SELECT name FROM driver WHERE id = ?', [id])[0]!.name as string;
  const cards = all(
    db,
    `SELECT c.id, c.storyline_id, c.beat, c.driver_id, s.template, s.driver_a, s.driver_b
       FROM event_card c JOIN storyline s ON s.id = c.storyline_id
      WHERE c.status = 'pending' ORDER BY c.id`,
  ).map((c): StoryCard => {
    const driverId = c.driver_id as number;
    const rivalId = (c.driver_a === driverId ? c.driver_b : c.driver_a) as number;
    return {
      id: c.id as number,
      storylineId: c.storyline_id as number,
      template: c.template as string,
      beat: c.beat as string,
      driverId,
      driverName: name(driverId),
      rivalId,
      rivalName: name(rivalId),
      choices: (templateOf(c.template as string)?.cards[c.beat as string] ?? []).map((x) => x.key),
    };
  });
  const mine = playerDrivers(db);
  const stories = all(
    db,
    "SELECT id, template, driver_a, driver_b, step FROM storyline WHERE status = 'open' AND highlighted = 1 ORDER BY id",
  ).map((s): StoryRow => {
    const a = s.driver_a as number;
    const b = s.driver_b as number;
    const own = mine.has(a) ? a : b;
    return {
      id: s.id as number,
      template: s.template as string,
      driverName: name(own),
      rivalName: name(own === a ? b : a),
      step: s.step as number,
      beats: templateOf(s.template as string)?.beats.length ?? 0,
    };
  });
  return { cards, stories };
}
