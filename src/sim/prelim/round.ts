// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { createRng } from '../rng';
import type { Sector } from '../courses/sectors';
import { simBalance } from '../worldgen/data';
import type { CourseData, Driver } from '../worldgen/types';
import { classifyPrelims, POLE_BONUS, type Classified } from './classify';
import { simulateLap } from './lap';
import { buildRunningOrder } from './order';
import { simulatePractice, type SimEvent } from './practice';
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
}

export interface PrelimRound {
  schedule: RoundSchedule;
  results: Classified[];
  events: SimEvent[];
  /** Racing kilometres added to each car during the round, practice and prelims together. */
  raceKm: Map<number, number>;
  poleEntryId: number | null;
  poleBonus: number;
}

/**
 * Plays out the practice week and the seven prelim days of one round. Deterministic for a
 * seed, season and round, and independent of the order entries are listed in.
 */
export function simulateRoundPrelims(input: RoundInput): PrelimRound {
  const rng = createRng(input.seed);
  const stream = (name: string) =>
    rng.stream(`prelim:${input.season}:R${input.roundNumber}:${name}`);
  const entries = [...input.entries].sort((a, b) => a.entryId - b.entryId);

  const schedule = planRoundDays(input.course, input.practiceStart, stream('weather'));
  const practice = simulatePractice(
    entries.map((e) => ({ entryId: e.entryId, carId: e.carId, wear: e.car.wear })),
    schedule.days,
    input.course.lapKm,
    stream('practice'),
  );
  const order = buildRunningOrder(entries, simBalance.prelims.days, stream('order'));
  const dayOf = new Map(
    schedule.days.filter((d) => d.prelimDay).map((d) => [d.prelimDay as number, d]),
  );
  const events: SimEvent[] = [...practice.events];
  const raceKm = new Map(practice.raceKm);
  const byEntry = new Map(entries.map((e) => [e.entryId, e]));

  const outcomes = order.map((run) => {
    const entry = byEntry.get(run.entryId) as PrelimEntry;
    const day = dayOf.get(run.day) as RoundSchedule['days'][number];
    const lap = simulateLap(
      entry.driver,
      entry.car,
      input.sectors,
      input.course.altitudeM,
      input.course.night,
      { dayTemperatureBias: day.temperatureBias },
      stream(`run:${entry.entryId}`),
    );
    const bonus = practice.setupBonus.get(entry.entryId) ?? 0;
    const timeMs = lap.timeMs === null ? null : Math.round(lap.timeMs * (1 - bonus));
    const ranKm =
      lap.dnfReason === 'crash'
        ? (lap.incidents.find((i) => i.kind === 'crash')?.km ?? input.course.lapKm)
        : input.course.lapKm;
    raceKm.set(entry.carId, (raceKm.get(entry.carId) ?? 0) + ranKm);
    for (const incident of lap.incidents) {
      events.push({
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
    return {
      entryId: entry.entryId,
      day: run.day,
      slot: run.slot,
      timeMs,
      dnfReason: lap.dnfReason,
    };
  });

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
    schedule,
    results,
    events: events.sort((a, b) => a.date.localeCompare(b.date)),
    raceKm,
    poleEntryId: pole?.entryId ?? null,
    poleBonus: POLE_BONUS(),
  };
}
