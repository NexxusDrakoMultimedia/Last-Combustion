// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import {
  FinalRace,
  type Call,
  type FinalSnapshot,
  type RaceEvent,
  type RetireReason,
} from '../sim/final/engine';
import { all } from './entries';
import { finalInput, type FinalContext } from './final';
import type { PrelimContext } from './prelims';
import { loadRace, prelimPlans } from './racestate';
import type { PrelimSnapshot } from '../sim/prelim/round';

/** One car in the timing tower of a final. */
export interface TowerRow {
  entryId: number;
  raceNumber: number;
  driver: string;
  /** The entry is one of the player's. */
  mine: boolean;
  /** Running position (1 for the leader), or null for a car that has retired. */
  position: number | null;
  /** Seconds behind the leader, and behind the car in front (null for the leader and for a retired car). */
  gapSeconds: number | null;
  intervalSeconds: number | null;
  /** How long the car took over the last sector it ran, in seconds. */
  lastSectorSeconds: number | null;
  /** Tyre life left, 0 to 100. */
  tyrePct: number;
  call: Call;
  /** The player has set this call (false when the computer is driving the car's calls). */
  controlled: boolean;
  retired: RetireReason | null;
}

/** One line of what has happened in the race. */
export interface FeedLine {
  type: RaceEvent['type'];
  lap: number;
  sector: number;
  /** Race numbers and names of the car the line is about and, for contact and passes, the other. */
  raceNumber: number;
  driver: string;
  otherRaceNumber: number | null;
  other: string | null;
  mine: boolean;
  /** The event is one the race stops for when it is asked to (a crash, a contact, rain). */
  pause: boolean;
  payload: Record<string, number | string>;
}

/** A final under way, as a timing screen shows it. */
export interface FinalView {
  roundNumber: number;
  /** The lap the race is on (1-based) and how many there are, and the sector within the lap. */
  lap: number;
  laps: number;
  sector: number;
  sectorCount: number;
  /** Sectors run, and in all. */
  progress: number;
  totalSectors: number;
  /** Rain falls on this lap, and the laps it covers (null for a dry race). */
  wet: boolean;
  weather: { startLap: number; endLap: number } | null;
  rows: TowerRow[];
  /** The latest events first. */
  feed: FeedLine[];
}

const FEED_LENGTH = 14;

/**
 * The timing screen of a final that has been started and is not over: the running order with gaps, the last
 * sector times, tyres and calls, the weather and what has just happened. Built from the saved race, so it
 * is the same wherever the player left it. Null when no final is under way for this round.
 */
export function finalView(db: Database, roundNumber: number): FinalView | null {
  const round = all(
    db,
    'SELECT ro.id FROM round ro WHERE ro.number = ? AND ro.season_id = (SELECT id FROM season ORDER BY year DESC LIMIT 1)',
    [roundNumber],
  )[0];
  if (!round) return null;
  const saved = loadRace<FinalContext, FinalSnapshot>(db, round.id as number, 'final');
  if (!saved) return null;
  const race = FinalRace.restore(finalInput(saved.input), saved.state);
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0]?.id as number | undefined;
  const entries = new Map(saved.input.entries.map((e) => [e.entryId, e]));
  const snapshot = new Map(saved.state.cars.map((c) => [c.entryId, c]));

  // The last sector time of each car is the difference between its two latest timing rows.
  const last = new Map<number, number>();
  const seen = new Map<number, number>();
  for (let i = race.timing.length - 1; i >= 0; i--) {
    const t = race.timing[i]!;
    const have = seen.get(t.entryId);
    if (have === undefined) seen.set(t.entryId, t.exitSeconds);
    else if (!last.has(t.entryId)) last.set(t.entryId, have - t.exitSeconds);
  }
  // A car on its first sector has one row: its time is its time since the start (the grid gap is small).
  for (const [entryId, exit] of seen) if (!last.has(entryId)) last.set(entryId, exit);

  const order = race.standings();
  const leader = order.length > 0 ? race.stateOf(order[0]!).timeSeconds : 0;
  const rows: TowerRow[] = [];
  const row = (
    entryId: number,
    position: number | null,
    gap: number | null,
    interval: number | null,
  ): TowerRow => {
    const e = entries.get(entryId)!;
    const car = snapshot.get(entryId)!;
    return {
      entryId,
      raceNumber: e.raceNumber,
      driver: e.driver.name,
      mine: player !== undefined && e.garageId === player,
      position,
      gapSeconds: gap,
      intervalSeconds: interval,
      lastSectorSeconds: last.has(entryId)
        ? Math.round((last.get(entryId) as number) * 100) / 100
        : null,
      tyrePct: Math.round(car.tyre * 10) / 10,
      call: car.call,
      controlled: car.controlled,
      retired: car.retired,
    };
  };
  order.forEach((entryId, i) => {
    const time = race.stateOf(entryId).timeSeconds;
    const ahead = i > 0 ? race.stateOf(order[i - 1]!).timeSeconds : null;
    rows.push(
      row(
        entryId,
        i + 1,
        i === 0 ? null : Math.round((time - leader) * 10) / 10,
        ahead === null ? null : Math.round((time - ahead) * 10) / 10,
      ),
    );
  });
  // Cars that have retired stay on the screen at the bottom, the latest to go first.
  for (const car of [...saved.state.cars].reverse())
    if (!car.alive) rows.push(row(car.entryId, null, null, null));

  const name = (entryId: number) => entries.get(entryId)!;
  const feed = [...race.events]
    .reverse()
    .slice(0, FEED_LENGTH)
    .map((e): FeedLine => {
      const main = name(e.entryId);
      const other = e.otherEntryId === null ? null : name(e.otherEntryId);
      return {
        type: e.type,
        lap: e.lap + 1,
        sector: e.sector + 1,
        raceNumber: main.raceNumber,
        driver: main.driver.name,
        otherRaceNumber: other ? other.raceNumber : null,
        other: other ? other.driver.name : null,
        mine:
          player !== undefined &&
          (main.garageId === player || (other !== null && other.garageId === player)),
        pause: e.pause,
        payload: e.payload,
      };
    });

  const progress = race.progress;
  const lapIndex = Math.min(race.laps - 1, Math.floor(progress / race.sectorCount));
  return {
    roundNumber,
    lap: lapIndex + 1,
    laps: race.laps,
    sector: (progress % race.sectorCount) + 1,
    sectorCount: race.sectorCount,
    progress,
    totalSectors: race.totalSectors,
    wet:
      race.weather !== null && lapIndex >= race.weather.startLap && lapIndex <= race.weather.endLap,
    weather: race.weather,
    rows,
    feed,
  };
}

/** One entry's lap in a prelim day. */
export interface PrelimRunRow {
  entryId: number;
  raceNumber: number;
  driver: string;
  mine: boolean;
  /** The lap time in milliseconds, or null for a run that ended in a crash. */
  timeMs: number | null;
  crashed: boolean;
}

/** One place in the running classification of the prelims. */
export interface PrelimStandingRow extends PrelimRunRow {
  position: number;
  /** Milliseconds behind the fastest so far. */
  gapMs: number;
  /** The entry is inside the places that reach the final, as things stand. */
  qualifying: boolean;
}

/** One incident on a prelim run. */
export interface PrelimFeedLine {
  type: string;
  date: string;
  raceNumber: number;
  driver: string;
  mine: boolean;
  secondsLost: number;
}

/** The prelims of a round under way, as a timing screen shows them. */
export interface PrelimView {
  roundNumber: number;
  /** The prelim day under way (1 to 7), its date, and how many days are done. */
  day: number;
  date: string;
  daysPlayed: number;
  totalDays: number;
  /** Runs on the day under way, and how many are run. */
  runsToday: number;
  runsPlayedToday: number;
  /** Runs run in all, and in all. */
  runsPlayed: number;
  runs: number;
  finalSize: number;
  /** The day's latest runs first. */
  latest: PrelimRunRow[];
  /** The fastest so far, best first. */
  standings: PrelimStandingRow[];
  /** The latest incidents first. */
  feed: PrelimFeedLine[];
}

const STANDINGS_LENGTH = 20;
const LATEST_LENGTH = 10;

/**
 * The prelims of a round that have been started and are not over: the day under way, the runs of the day as
 * they come in, the classification as it stands and the incidents. Built from the saved round, so it is the
 * same wherever the player left it. Null when no prelims are under way for this round.
 */
export function prelimView(db: Database, roundNumber: number): PrelimView | null {
  const round = all(
    db,
    'SELECT ro.id FROM round ro WHERE ro.number = ? AND ro.season_id = (SELECT id FROM season ORDER BY year DESC LIMIT 1)',
    [roundNumber],
  )[0];
  if (!round) return null;
  const saved = loadRace<PrelimContext, PrelimSnapshot>(db, round.id as number, 'prelims');
  const plan = prelimPlans(db).find((p) => p.roundNumber === roundNumber);
  if (!saved || !plan) return null;
  const player = all(db, 'SELECT id FROM garage WHERE is_player = 1')[0]?.id as number | undefined;
  const garageOf = new Map(saved.input.loaded.map((e) => [e.entryId, e.garageId]));
  const entries = new Map(saved.input.entries.map((e) => [e.entryId, e]));
  const mine = (entryId: number) => player !== undefined && garageOf.get(entryId) === player;
  const row = (entryId: number, timeMs: number | null): PrelimRunRow => {
    const e = entries.get(entryId)!;
    return {
      entryId,
      raceNumber: e.raceNumber,
      driver: e.driver.name,
      mine: mine(entryId),
      timeMs,
      crashed: timeMs === null,
    };
  };

  const done = saved.state.outcomes.filter((o): o is NonNullable<typeof o> => o !== null);
  const day = Math.min(plan.days.length, saved.state.daysPlayed + 1);
  const today = plan.days.find((d) => d.day === day);
  const todays = done.filter((o) => o.day === day);
  const timed = done
    .filter((o) => o.timeMs !== null)
    .sort((a, b) => (a.timeMs as number) - (b.timeMs as number) || a.entryId - b.entryId);
  const best = timed[0]?.timeMs ?? 0;
  const feed = saved.state.events
    .filter((e) => e.scope === 'prelim' && e.entryId !== null && entries.has(e.entryId))
    .slice(-FEED_LENGTH)
    .reverse()
    .map((e): PrelimFeedLine => {
      const entry = entries.get(e.entryId as number)!;
      return {
        type: e.type,
        date: e.date,
        raceNumber: entry.raceNumber,
        driver: entry.driver.name,
        mine: mine(e.entryId as number),
        secondsLost: Number(e.payload.secondsLost ?? 0),
      };
    });
  return {
    roundNumber,
    day,
    date: today?.date ?? '',
    daysPlayed: saved.state.daysPlayed,
    totalDays: plan.days.length,
    runsToday: today?.runs ?? 0,
    runsPlayedToday: todays.length,
    runsPlayed: done.length,
    runs: saved.input.entries.length,
    finalSize: saved.input.finalSize,
    latest: [...todays]
      .sort((a, b) => b.slot - a.slot)
      .slice(0, LATEST_LENGTH)
      .map((o) => row(o.entryId, o.timeMs)),
    standings: timed.slice(0, STANDINGS_LENGTH).map((o, i) => ({
      ...row(o.entryId, o.timeMs),
      position: i + 1,
      gapMs: (o.timeMs as number) - best,
      qualifying: i + 1 <= saved.input.finalSize,
    })),
    feed,
  };
}
