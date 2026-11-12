// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  highlightFans,
  highlightReputation,
  newsCap,
  pickHighlights,
  pickNewsJournalist,
  type CrashCandidate,
  type NewsKind,
} from '../sim/news';
import { journalistById, type Journalist } from '../sim/press';
import { createRng } from '../sim/rng';
import { readCareer } from './career';
import { all } from './entries';
import { addFans } from './fans';
import { adjustReputation } from './reputation';
import { crashRepairCost } from './repairs';

/** One item of the world's news, as the Press panel shows it. */
export interface NewsLine {
  id: number;
  kind: NewsKind;
  /** What it is about: the scope of a crash, the kind of a rivalry meeting, `template.beat` of a story. */
  detail: string;
  driver: string;
  other: string | null;
  journalist: Journalist;
  round: number;
  year: number;
}

const marked = (db: Database, roundId: number, type: string): boolean =>
  all(db, 'SELECT 1 FROM event_log WHERE round_id = ? AND type = ?', [roundId, type]).length > 0;

const mark = (db: Database, roundId: number, date: string, type: string) =>
  db.run(
    "INSERT INTO event_log (round_id, scope, occurred_on, type, payload) VALUES (?, 'season', ?, ?, '{}')",
    [roundId, date, type],
  );

/**
 * Puts the round's big crashes on the highlight reel (see the GDD, "Attention flags" and "Fans"): a
 * crash in a final, or in the prelims with a dear enough repair bill; the dearest two a round. A
 * highlight raises the driver's fans (and so their fame, which is their notoriety) and costs them
 * reputation, on top of the repair bill. Each is written to the event log as a `highlight`. Running a
 * round again changes nothing.
 */
export function applyCrashHighlights(db: Database, roundId: number): void {
  if (marked(db, roundId, 'highlight_update')) return;
  const round = all(
    db,
    `SELECT ro.final_date, ro.season_id, s.series_fans FROM round ro JOIN season s ON s.id = ro.season_id
      WHERE ro.id = ?`,
    [roundId],
  )[0];
  if (!round) return;
  const date = round.final_date as string;
  const crashes = all(
    db,
    `SELECT ev.entry_id, ev.scope, e.driver_id, m.price_new
       FROM event_log ev JOIN entry e ON e.id = ev.entry_id AND e.series = 'main'
       JOIN car c ON c.id = e.car_id JOIN car_model m ON m.id = c.car_model_id
      WHERE ev.round_id = ? AND ev.type = 'crash' AND ev.scope IN ('prelim', 'final')
      ORDER BY ev.id`,
    [roundId],
  );
  const drivers = new Map(crashes.map((c) => [c.entry_id as number, c.driver_id as number]));
  const candidates: CrashCandidate[] = crashes.map((c) => ({
    entryId: c.entry_id as number,
    scope: c.scope as 'prelim' | 'final',
    repair: crashRepairCost(c.price_new as number),
  }));
  const audience = round.series_fans as number;
  for (const h of pickHighlights(candidates)) {
    const driverId = drivers.get(h.entryId)!;
    addFans(db, 'driver', driverId, highlightFans(audience), audience, round.season_id as number);
    adjustReputation(db, driverId, highlightReputation());
    db.run(
      "INSERT INTO event_log (round_id, scope, occurred_on, type, entry_id, payload) VALUES (?, 'event', ?, 'highlight', ?, ?)",
      [
        roundId,
        date,
        h.entryId,
        JSON.stringify({ entry: h.entryId, driver: driverId, scope: h.scope, repair: h.repair }),
      ],
    );
  }
  mark(db, roundId, date, 'highlight_update');
}

/**
 * Writes the round's news for the whole world (see the GDD, "The press" and "Around the series"): the winner, the crash highlights,
 * the rivalry meetings and the storyline beats, up to the cap for each kind, each by a journalist
 * drawn from the stream `news:<round>`. Running a round again changes nothing.
 */
export function writeNews(db: Database, roundId: number): void {
  if (marked(db, roundId, 'news_update')) return;
  // The crash news reads the highlights, so they are always applied first (a rerun changes nothing).
  applyCrashHighlights(db, roundId);
  const round = all(db, 'SELECT final_date FROM round WHERE id = ?', [roundId])[0];
  const career = readCareer(db);
  if (!round || !career) return;
  const date = round.final_date as string;
  const rng = createRng(career.masterSeed).stream(`news:${roundId}`);
  const write = (
    kind: NewsKind,
    driverId: number,
    otherId: number | null,
    detail: string,
    refId: number,
  ) =>
    db.run(
      `INSERT INTO news (round_id, kind, driver_id, other_driver_id, detail, ref_id, journalist_id, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [roundId, kind, driverId, otherId, detail, refId, pickNewsJournalist(rng, kind).id, date],
    );

  for (const w of all(
    db,
    `SELECT e.driver_id FROM result r JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
      WHERE r.round_id = ? AND r.final_pos = 1 ORDER BY r.id LIMIT ?`,
    [roundId, newsCap('winner')],
  ))
    write('winner', w.driver_id as number, null, '', 0);

  for (const h of all(
    db,
    `SELECT entry_id, json_extract(payload, '$.driver') AS driver_id, json_extract(payload, '$.scope') AS scope
       FROM event_log WHERE round_id = ? AND type = 'highlight' ORDER BY id LIMIT ?`,
    [roundId, newsCap('crash')],
  ))
    write('crash', h.driver_id as number, null, h.scope as string, h.entry_id as number);

  for (const m of all(
    db,
    `SELECT m.rivalry_id, m.kind, rv.driver_a, rv.driver_b FROM rivalry_meeting m
       JOIN rivalry rv ON rv.id = m.rivalry_id
      WHERE m.round_id = ? AND rv.live = 1 ORDER BY rv.heat DESC, m.id LIMIT ?`,
    [roundId, newsCap('rivalry')],
  ))
    write(
      'rivalry',
      m.driver_a as number,
      m.driver_b as number,
      m.kind as string,
      m.rivalry_id as number,
    );

  for (const b of all(
    db,
    `SELECT b.id, b.beat, s.template, s.driver_a, s.driver_b FROM storyline_beat b
       JOIN storyline s ON s.id = b.storyline_id WHERE b.round_id = ? ORDER BY b.id LIMIT ?`,
    [roundId, newsCap('story')],
  ))
    write(
      'story',
      b.driver_a as number,
      b.driver_b as number,
      `${String(b.template)}.${String(b.beat)}`,
      b.id as number,
    );

  mark(db, roundId, date, 'news_update');
}

/** The latest news of the world, newest first. */
export function newsFeed(db: Database, limit = 20): NewsLine[] {
  return all(
    db,
    `SELECT n.id, n.kind, n.detail, n.journalist_id, da.name AS driver, db.name AS other,
            ro.number AS round, s.year
       FROM news n JOIN driver da ON da.id = n.driver_id LEFT JOIN driver db ON db.id = n.other_driver_id
       JOIN round ro ON ro.id = n.round_id JOIN season s ON s.id = ro.season_id
      ORDER BY n.id DESC LIMIT ?`,
    [limit],
  ).flatMap((r) => {
    const journalist = journalistById(r.journalist_id as number);
    return journalist
      ? [
          {
            id: r.id as number,
            kind: r.kind as NewsKind,
            detail: r.detail as string,
            driver: r.driver as string,
            other: (r.other as string | null) ?? null,
            journalist,
            round: r.round as number,
            year: r.year as number,
          },
        ]
      : [];
  });
}

/** How many crashes have made the highlight reel in this save. */
export function highlightTotal(db: Database): number {
  return all(db, "SELECT COUNT(*) AS n FROM event_log WHERE type = 'highlight'")[0]!.n as number;
}
