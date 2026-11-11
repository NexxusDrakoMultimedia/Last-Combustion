// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  closeFinishPairs,
  decayHeat,
  levelFor,
  settleCap,
  titleFightPair,
  type Pair,
  type RivalryLevel,
} from '../sim/rivalry';
import { rivalryBalance } from '../sim/worldgen/data';
import { all } from './entries';

type EndReason = 'cooled' | 'retired' | 'reconciled' | 'displaced';

interface Working {
  id: number;
  a: number;
  b: number;
  heat: number;
  peak: number;
  live: boolean;
  startedYear: number;
  gained: boolean;
  wasLive: boolean;
  ended: EndReason | null;
}

/** Keeps heat tidy in the database: two decimals, the same every time. */
const tidy = (n: number): number => Math.round(n * 100) / 100;

/**
 * Applies what a finished final does to the world's rivalries (see the GDD, "Rivalries"), once for
 * each round: every open rivalry cools, finishing within half a second of another driver and a
 * head-to-head between the two title leaders add heat, a pair that reaches Spark goes live if both
 * drivers have room (or if it is hotter than their coolest live rivalry), and rivalries end when
 * they cool under ten or when a driver has retired. Returns the level of each rivalry that went live.
 */
export function updateRivalries(db: Database, roundId: number): RivalryLevel[] {
  if (
    all(db, "SELECT 1 FROM event_log WHERE round_id = ? AND type = 'rivalry_update'", [roundId])
      .length > 0
  )
    return [];
  const round = all(
    db,
    `SELECT ro.number, ro.season_id, ro.final_date, s.year
       FROM round ro JOIN season s ON s.id = ro.season_id WHERE ro.id = ?`,
    [roundId],
  )[0];
  if (!round) return [];
  const year = round.year as number;
  const rb = rivalryBalance;

  // What happened in the final.
  const finishers = all(
    db,
    `SELECT e.driver_id, r.final_time_ms FROM result r
       JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
      WHERE r.round_id = ? AND r.final_pos IS NOT NULL ORDER BY r.final_pos`,
    [roundId],
  ).map((r) => ({ driverId: r.driver_id as number, timeMs: r.final_time_ms as number | null }));
  const gains: { pair: Pair; kind: 'close_finish' | 'title_fight'; gain: number }[] =
    closeFinishPairs(finishers).map((pair) => ({
      pair,
      kind: 'close_finish',
      gain: rb.gains.closeFinish,
    }));
  if ((round.number as number) > 1) {
    const leaders = all(
      db,
      `SELECT e.driver_id, SUM(r.points) AS total FROM result r
         JOIN entry e ON e.id = r.entry_id AND e.series = 'main'
         JOIN round ro ON ro.id = r.round_id
        WHERE ro.season_id = ? AND ro.number <= ?
        GROUP BY e.driver_id ORDER BY total DESC, e.driver_id LIMIT 2`,
      [round.season_id as number, round.number as number],
    ).map((r) => r.driver_id as number);
    const fight = titleFightPair(
      leaders.length === 2 ? [leaders[0]!, leaders[1]!] : null,
      finishers.map((f) => f.driverId),
    );
    if (fight) gains.push({ pair: fight, kind: 'title_fight', gain: rb.gains.titleFight });
  }

  // The open rivalries, cooled by a round.
  const rows = new Map<number, Working>();
  for (const r of all(
    db,
    'SELECT id, driver_a, driver_b, heat, peak, live, started_year FROM rivalry WHERE ended_year IS NULL ORDER BY id',
  )) {
    rows.set(r.id as number, {
      id: r.id as number,
      a: r.driver_a as number,
      b: r.driver_b as number,
      heat: decayHeat(r.heat as number),
      peak: r.peak as number,
      live: r.live === 1,
      wasLive: r.live === 1,
      startedYear: r.started_year as number,
      gained: false,
      ended: null,
    });
  }
  const find = (p: Pair) => [...rows.values()].find((w) => w.a === p.a && w.b === p.b);

  // The round's shared moments.
  for (const g of gains) {
    let w = find(g.pair);
    if (!w) {
      db.run(
        `INSERT INTO rivalry (driver_a, driver_b, heat, peak, level, live, started_year, started_round_id)
         VALUES (?, ?, 0, 0, 'none', 0, ?, ?)`,
        [g.pair.a, g.pair.b, year, roundId],
      );
      const id = all(db, 'SELECT last_insert_rowid() AS id')[0]!.id as number;
      w = {
        id,
        a: g.pair.a,
        b: g.pair.b,
        heat: 0,
        peak: 0,
        live: false,
        wasLive: false,
        startedYear: year,
        gained: false,
        ended: null,
      };
      rows.set(id, w);
    }
    if (
      all(db, 'SELECT 1 FROM rivalry_meeting WHERE rivalry_id = ? AND round_id = ? AND kind = ?', [
        w.id,
        roundId,
        g.kind,
      ]).length > 0
    )
      continue;
    db.run('INSERT INTO rivalry_meeting (rivalry_id, round_id, kind, gain) VALUES (?, ?, ?, ?)', [
      w.id,
      roundId,
      g.kind,
      g.gain,
    ]);
    w.heat = Math.min(rb.ceiling, w.heat + g.gain);
    w.gained = true;
  }
  for (const w of rows.values()) w.peak = Math.max(w.peak, w.heat);

  // Endings: a retired driver, or a rivalry that cooled and found nothing new this round.
  const retired = new Set(
    all(db, 'SELECT id FROM driver WHERE retired_year IS NOT NULL').map((r) => r.id as number),
  );
  for (const w of rows.values()) {
    if (retired.has(w.a) || retired.has(w.b)) w.ended = 'retired';
    else if (!w.gained && w.heat < rb.endBelow) w.ended = 'cooled';
  }

  // Pairs that reached Spark go live if both drivers have room, hottest first.
  const open = () => [...rows.values()].filter((w) => w.ended === null);
  const candidates = open()
    .filter((w) => !w.live && w.heat >= rb.levels.spark)
    .sort((x, y) => y.heat - x.heat || x.id - y.id);
  const wentLive: RivalryLevel[] = [];
  for (const w of candidates) {
    const verdicts = [w.a, w.b].map((driver) => {
      const mine = open().filter((o) => o.live && (o.a === driver || o.b === driver));
      return {
        mine,
        verdict: settleCap(
          mine.map((o) => o.heat),
          w.heat,
          rb.cap,
        ),
      };
    });
    if (verdicts.some((v) => v.verdict === 'refuse')) {
      w.heat = Math.min(w.heat, rb.levels.spark - 1);
      continue;
    }
    for (const v of verdicts) {
      if (v.verdict !== 'displace') continue;
      const coolest = [...v.mine].sort((x, y) => x.heat - y.heat || x.id - y.id)[0]!;
      coolest.ended = 'displaced';
    }
    w.live = true;
  }

  // Write the round back.
  for (const w of rows.values()) {
    let level: RivalryLevel = w.live ? levelFor(w.heat, year - w.startedYear) : 'none';
    if (w.live && level === 'none') level = 'spark';
    if (w.live && !w.wasLive && w.ended === null) wentLive.push(level);
    db.run(
      'UPDATE rivalry SET heat = ?, peak = ?, level = ?, live = ?, ended_year = ?, end_reason = ? WHERE id = ?',
      [tidy(w.heat), tidy(w.peak), level, w.live ? 1 : 0, w.ended ? year : null, w.ended, w.id],
    );
  }
  db.run(
    "INSERT INTO event_log (round_id, scope, occurred_on, type, payload) VALUES (?, 'season', ?, 'rivalry_update', '{}')",
    [roundId, round.final_date as string],
  );
  return wentLive;
}
