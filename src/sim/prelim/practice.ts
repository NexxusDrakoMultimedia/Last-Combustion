// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { RandomStream } from '../rng';
import { simBalance } from '../worldgen/data';
import type { DayPlan } from './weather';

export interface SimEvent {
  scope: 'practice' | 'prelim' | 'final' | 'event' | 'season';
  date: string;
  km: number | null;
  type: string;
  entryId: number | null;
  payload: Record<string, unknown>;
}

export interface PracticeResult {
  events: SimEvent[];
  /** Kilometres each car covered in practice. They count as racing kilometres. */
  raceKm: Map<number, number>;
  /** A fractional lap-time gain per entry from a setup breakthrough. */
  setupBonus: Map<number, number>;
}

/**
 * Practice on the 7 practice days and any gap days (see the GDD, "Incidents"): every entry
 * runs a few laps a day, which wears the car, and may suffer a breakdown, a crash or find
 * a better setup.
 */
export function simulatePractice(
  entries: readonly { entryId: number; carId: number; wear: number }[],
  days: readonly DayPlan[],
  lapKm: number,
  rng: RandomStream,
): PracticeResult {
  const cfg = simBalance.practice;
  const events: SimEvent[] = [];
  const raceKm = new Map<number, number>();
  const setupBonus = new Map<number, number>();

  for (const day of days.filter((d) => d.kind !== 'prelim')) {
    for (const entry of entries) {
      const laps = rng.int(cfg.lapsPerDay[0] as number, cfg.lapsPerDay[1] as number);
      let covered = 0;
      let outForDay = false;
      for (let lap = 0; lap < laps && !outForDay; lap++) {
        const km = Math.round(rng.float(0.1, 0.9) * lapKm * 10) / 10;
        if (rng.chance(cfg.crashPerLap)) {
          events.push({
            scope: 'practice',
            date: day.date,
            km,
            type: 'crash',
            entryId: entry.entryId,
            payload: { repairDays: rng.int(1, 3) },
          });
          covered += km;
          outForDay = true;
        } else if (rng.chance(cfg.breakdownPerLap * (1 + entry.wear / 25))) {
          events.push({
            scope: 'practice',
            date: day.date,
            km,
            type: 'breakdown',
            entryId: entry.entryId,
            payload: { repairDays: rng.int(1, 2) },
          });
          covered += km;
          outForDay = true;
        } else {
          covered += lapKm;
        }
      }
      // Practice runs are short, gentle test runs: only a tenth of their distance counts as race
      // kilometres, so a season of practice wears a car about as much as a few laps of racing.
      raceKm.set(entry.carId, (raceKm.get(entry.carId) ?? 0) + covered * cfg.kmShare);
      if (!outForDay && rng.chance(cfg.breakthroughPerDay)) {
        const gain = Math.round(rng.float(0.001, 0.003) * 10000) / 10000;
        setupBonus.set(entry.entryId, Math.max(setupBonus.get(entry.entryId) ?? 0, gain));
        events.push({
          scope: 'practice',
          date: day.date,
          km: null,
          type: 'setup_breakthrough',
          entryId: entry.entryId,
          payload: { gain },
        });
      }
    }
  }
  return { events, raceKm, setupBonus };
}
