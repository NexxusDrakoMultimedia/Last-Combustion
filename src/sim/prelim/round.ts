// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createRng } from '../rng';
import type { Sector } from '../courses/sectors';
import { simBalance } from '../worldgen/data';
import type { CourseData, Driver } from '../worldgen/types';
import {
  attentionFlags,
  predictedSectorMs,
  type AttentionFlag,
  type AttentionRun,
} from './attention';
import { classifyPrelims, POLE_BONUS, type Classified, type RunOutcome } from './classify';
import { simulateLap, type RunPlan } from './lap';
import { buildRunningOrder } from './order';
import { simulatePractice, type PracticeEffect, type SimEvent } from './practice';
import type { CarSpec } from './ratings';
import { planRoundDays, type RoundSchedule } from './weather';

export interface PrelimEntry {
  entryId: number;
  carId: number;
  raceNumber: number;
  driver: Driver;
  car: CarSpec;
  /** Championship points so far this season. */
  points: number;
}

export interface RoundInput {
  seed: string;
  season: number;
  roundNumber: number;
  course: CourseData;
  sectors: readonly Sector[];
  practiceStart: string;
  finalSize: number;
  entries: readonly PrelimEntry[];
  /** Entries held back in practice by a supply outage. */
  practiceHandicaps?: ReadonlyMap<number, PracticeEffect>;
}

export interface PrelimRound {
  schedule: RoundSchedule;
  results: Classified[];
  events: SimEvent[];
  /** Racing kilometres added to each car during the round, practice and prelims together. */
  raceKm: Map<number, number>;
  poleEntryId: number | null;
  poleBonus: number;
  /** The runs the series' computer flagged for pace well beyond what their car should manage, best first. */
  attentionFlags: AttentionFlag[];
}

/**
 * The whole state of a round's prelims in progress as plain data, so it can be saved between days. The
 * practice week, the weather and the running order come from the seed, so only what the prelim days have
 * produced so far is kept. Every run draws from a stream named for the round and the entry, so a
 * restored round plays on exactly as one that was never saved.
 */
export interface PrelimSnapshot {
  /** Prelim days already run (0 to 7). */
  daysPlayed: number;
  /** The outcome of each run in running-order position, null for a run still to come. */
  outcomes: (RunOutcome | null)[];
  attentionRuns: AttentionRun[];
  events: SimEvent[];
  raceKm: [carId: number, km: number][];
  /** The plans the garage has given for runs still to come (steady when none). */
  plans?: [entryId: number, plan: RunPlan][];
}

/**
 * The practice week and the seven prelim days of one round, played a day at a time. Deterministic for
 * a seed, season and round, and independent of the order entries are listed in. Playing every day in
 * turn gives exactly what `simulateRoundPrelims` returns.
 */
export class PrelimRoundRun {
  readonly schedule: RoundSchedule;
  private readonly entries: PrelimEntry[];
  private readonly byEntry: Map<number, PrelimEntry>;
  private readonly practice: ReturnType<typeof simulatePractice>;
  private readonly order: ReturnType<typeof buildRunningOrder>;
  private readonly dayOf: Map<number, RoundSchedule['days'][number]>;
  private readonly rng: ReturnType<typeof createRng>;
  private outcomes: (RunOutcome | null)[];
  private attentionRuns: AttentionRun[] = [];
  private events: SimEvent[];
  private raceKm: Map<number, number>;
  private played = 0;
  private plans = new Map<number, RunPlan>();

  constructor(private readonly input: RoundInput) {
    this.rng = createRng(input.seed);
    this.entries = [...input.entries].sort((a, b) => a.entryId - b.entryId);
    this.schedule = planRoundDays(input.course, input.practiceStart, this.stream('weather'));
    this.practice = simulatePractice(
      this.entries.map((e) => ({ entryId: e.entryId, carId: e.carId, wear: e.car.wear })),
      this.schedule.days,
      input.course.lapKm,
      this.stream('practice'),
      input.practiceHandicaps,
    );
    this.order = buildRunningOrder(this.entries, simBalance.prelims.days, this.stream('order'));
    this.dayOf = new Map(
      this.schedule.days.filter((d) => d.prelimDay).map((d) => [d.prelimDay as number, d]),
    );
    this.events = [...this.practice.events];
    this.raceKm = new Map(this.practice.raceKm);
    this.byEntry = new Map(this.entries.map((e) => [e.entryId, e]));
    this.outcomes = this.order.map(() => null);
  }

  private stream(name: string) {
    const i = this.input;
    return this.rng.stream(`prelim:${i.season}:R${i.roundNumber}:${name}`);
  }

  /** Prelim days already run. */
  get daysPlayed(): number {
    return this.played;
  }
  get finished(): boolean {
    return this.played >= simBalance.prelims.days;
  }

  /** How many runs a prelim day holds, and how many of them have been run. */
  runsOnDay(day: number): { total: number; played: number } {
    let total = 0;
    let played = 0;
    this.order.forEach((run, position) => {
      if (run.day !== day) return;
      total += 1;
      if (this.outcomes[position] !== null) played += 1;
    });
    return { total, played };
  }

  /** Where an entry runs: its day and slot, and whether the run has been run. Null for an entry not in the round. */
  runOf(entryId: number): { day: number; slot: number; played: boolean } | null {
    const position = this.order.findIndex((run) => run.entryId === entryId);
    if (position === -1) return null;
    const run = this.order[position]!;
    return { day: run.day, slot: run.slot, played: this.outcomes[position] !== null };
  }

  /** The plan given for an entry's run (steady when none was given). */
  planOf(entryId: number): RunPlan {
    return this.plans.get(entryId) ?? 'steady';
  }

  /** Gives an entry's run a plan (null goes back to steady). Refuses an entry not in the round and a run already run. */
  setPlan(entryId: number, plan: RunPlan | null): void {
    const at = this.runOf(entryId);
    if (!at) throw new Error(`No such entry in the round: ${entryId}`);
    if (at.played) throw new Error('That run has already been run.');
    if (plan === null || plan === 'steady') this.plans.delete(entryId);
    else this.plans.set(entryId, plan);
  }

  private nextPosition(day: number): number {
    return this.order.findIndex(
      (run, position) => run.day === day && this.outcomes[position] === null,
    );
  }

  /**
   * Plays the next run of the prelim day under way (the next entry in the running order that has not yet set
   * its lap) and returns the events it produced. When it was the last run of the day, the day is done.
   */
  playRun(): SimEvent[] {
    if (this.finished) return [];
    const days = simBalance.prelims.days;
    // A day with nothing left to run is passed over.
    let dayNumber = this.played + 1;
    let position = this.nextPosition(dayNumber);
    while (position === -1) {
      this.played = dayNumber;
      if (dayNumber >= days) return [];
      dayNumber += 1;
      position = this.nextPosition(dayNumber);
    }
    const day = this.dayOf.get(dayNumber) as RoundSchedule['days'][number];
    const run = this.order[position]!;
    const made: SimEvent[] = [];
    const entry = this.byEntry.get(run.entryId) as PrelimEntry;
    const lap = simulateLap(
      entry.driver,
      entry.car,
      this.input.sectors,
      this.input.course.altitudeM,
      this.input.course.night,
      { dayTemperatureBias: day.temperatureBias, plan: this.plans.get(entry.entryId) },
      this.stream(`run:${entry.entryId}`),
    );
    const bonus = this.practice.setupBonus.get(entry.entryId) ?? 0;
    const timeMs = lap.timeMs === null ? null : Math.round(lap.timeMs * (1 - bonus));
    const predicted = predictedSectorMs(
      entry.car,
      this.input.sectors,
      this.input.course.altitudeM,
      day.temperatureBias,
    );
    this.attentionRuns.push({
      entryId: entry.entryId,
      predictedMs: Math.round(predicted.reduce((a, b) => a + b, 0) * (1 - bonus)),
      actualMs: timeMs,
      sectorGainMs: predicted.map((p, i) => p - (lap.sectorMs[i] ?? p)),
    });
    const ranKm =
      lap.dnfReason === 'crash'
        ? (lap.incidents.find((i) => i.kind === 'crash')?.km ?? this.input.course.lapKm)
        : this.input.course.lapKm;
    this.raceKm.set(entry.carId, (this.raceKm.get(entry.carId) ?? 0) + ranKm);
    for (const incident of lap.incidents) {
      made.push({
        scope: 'prelim',
        date: day.date,
        km: Math.round(incident.km * 100) / 100,
        type: incident.kind,
        entryId: entry.entryId,
        payload: {
          secondsLost: Math.round(incident.secondsLost * 10) / 10,
          sector: incident.sector,
        },
      });
    }
    this.outcomes[position] = {
      entryId: entry.entryId,
      day: run.day,
      slot: run.slot,
      timeMs,
      dnfReason: lap.dnfReason,
    };
    this.events.push(...made);
    if (this.nextPosition(dayNumber) === -1) this.played = dayNumber;
    return made;
  }

  /** Runs the rest of the prelim day under way, every entry that runs on it. Returns the events the day produced. */
  playDay(): SimEvent[] {
    const made: SimEvent[] = [];
    const day = this.played;
    while (!this.finished && this.played === day) made.push(...this.playRun());
    return made;
  }

  /** Plays every day still to come. */
  playToEnd(): void {
    while (!this.finished) this.playDay();
  }

  /** The round as plain data, deep-copied, ready to be written to a save. */
  snapshot(): PrelimSnapshot {
    return {
      daysPlayed: this.played,
      outcomes: structuredClone(this.outcomes),
      attentionRuns: structuredClone(this.attentionRuns),
      events: structuredClone(this.events),
      raceKm: [...this.raceKm],
      plans: [...this.plans],
    };
  }

  /** A round picked up from a snapshot, with the input it was started with. */
  static restore(input: RoundInput, snapshot: PrelimSnapshot): PrelimRoundRun {
    const run = new PrelimRoundRun(input);
    if (snapshot.outcomes.length !== run.outcomes.length)
      throw new Error('The saved round has a different field from this one.');
    run.played = snapshot.daysPlayed;
    run.outcomes = structuredClone(snapshot.outcomes);
    run.attentionRuns = structuredClone(snapshot.attentionRuns);
    run.events = structuredClone(snapshot.events);
    run.raceKm = new Map(snapshot.raceKm);
    run.plans = new Map(snapshot.plans ?? []);
    return run;
  }

  /** The finished round: the classification, the events and the flags. Only once every day has been run. */
  result(): PrelimRound {
    if (!this.finished) throw new Error('The prelims have days still to run.');
    const { input, dayOf } = this;
    const events = [...this.events];
    const outcomes = this.outcomes as RunOutcome[];

    // A crash blocks the road: the next runner is held and restarted.
    const bySlot = [...outcomes].sort((a, b) => a.day - b.day || a.slot - b.slot);
    bySlot.forEach((run, i) => {
      const next = bySlot[i + 1];
      if (run.dnfReason === 'crash' && next && next.day === run.day) {
        events.push({
          scope: 'prelim',
          date: (dayOf.get(run.day) as RoundSchedule['days'][number]).date,
          km: null,
          type: 'blocked_course',
          entryId: next.entryId,
          payload: { heldBehind: run.entryId },
        });
      }
    });

    const flags = attentionFlags(this.attentionRuns);
    for (const flag of flags) {
      const run = outcomes.find((o) => o.entryId === flag.entryId) as RunOutcome;
      const sector = input.sectors[flag.sector];
      events.push({
        scope: 'prelim',
        date: (dayOf.get(run.day) as RoundSchedule['days'][number]).date,
        km: sector ? Math.round((sector.startKm + sector.lengthM / 2000) * 100) / 100 : null,
        type: 'attention',
        entryId: flag.entryId,
        payload: { z: flag.z, gainMs: flag.gainMs, sector: flag.sector },
      });
    }

    const results = classifyPrelims(outcomes, input.finalSize);
    const pole = results.find((r) => r.pole) ?? null;
    if (pole) {
      events.push({
        scope: 'prelim',
        date: (dayOf.get(pole.day) as RoundSchedule['days'][number]).date,
        km: null,
        type: 'pole',
        entryId: pole.entryId,
        payload: { timeMs: pole.timeMs },
      });
    }
    return {
      schedule: this.schedule,
      results,
      events: events.sort((a, b) => a.date.localeCompare(b.date)),
      raceKm: new Map(this.raceKm),
      poleEntryId: pole?.entryId ?? null,
      poleBonus: POLE_BONUS(),
      attentionFlags: flags,
    };
  }
}

/**
 * Plays out the practice week and the seven prelim days of one round. Deterministic for a
 * seed, season and round, and independent of the order entries are listed in.
 */
export function simulateRoundPrelims(input: RoundInput): PrelimRound {
  const run = new PrelimRoundRun(input);
  run.playToEnd();
  return run.result();
}
