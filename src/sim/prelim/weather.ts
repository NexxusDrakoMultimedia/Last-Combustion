// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { addDays } from '../worldgen/calendar';
import { simBalance } from '../worldgen/data';
import type { RandomStream } from '../rng';
import type { CourseData } from '../worldgen/types';

export type Weather = 'dry_clear' | 'overcast' | 'wet';
export type DayKind = 'practice' | 'prelim' | 'gap';

export interface DayPlan {
  date: string;
  weather: Weather;
  kind: DayKind;
  /** 1 to 7 on days when prelim runs are held. */
  prelimDay: number | null;
  temperatureC: number;
  /** Shared effect on lap times for the whole day (positive is slower). */
  temperatureBias: number;
}

export interface RoundSchedule {
  days: DayPlan[];
  /** The day after the last prelim day. */
  finalDate: string;
}

type Climate = Record<Weather, number>;
const climateOf = (course: CourseData): Climate =>
  (course as unknown as { climate: Climate }).climate;
const baseTempOf = (course: CourseData): number =>
  (course as unknown as { baseTempC: number }).baseTempC;

function rollWeather(course: CourseData, rng: RandomStream): Weather {
  const climate = climateOf(course);
  return rng.weighted<Weather>(
    ['dry_clear', 'overcast', 'wet'],
    [climate.dry_clear, climate.overcast, climate.wet],
  );
}

/**
 * Plans every day of a round (see the GDD, "Weekend format"): 7 practice days, then prelim
 * days that are only held on dry, clear days. A wet or overcast day becomes an extra practice
 * day, so every round still gets seven full prelim days. If the weather has blocked the prelims
 * for more than 14 days, the next overcast day is declared dry enough.
 */
export function planRoundDays(
  course: CourseData,
  practiceStart: string,
  rng: RandomStream,
): RoundSchedule {
  const cfg = simBalance.prelims;
  const days: DayPlan[] = [];
  const make = (
    index: number,
    weather: Weather,
    kind: DayKind,
    prelimDay: number | null,
  ): DayPlan => {
    const temperatureC =
      Math.round(
        (baseTempOf(course) +
          rng.normal(0, 3) +
          (weather === 'dry_clear' ? 2 : weather === 'wet' ? -3 : 0)) *
          10,
      ) / 10;
    return {
      date: addDays(practiceStart, index),
      weather,
      kind,
      prelimDay,
      temperatureC,
      temperatureBias: Math.max(-0.004, Math.min(0.004, rng.normal(0, simBalance.temp.daySd))),
    };
  };

  for (let i = 0; i < 7; i++) days.push(make(i, rollWeather(course, rng), 'practice', null));

  let held = 0;
  let waiting = 0;
  let index = 7;
  while (held < cfg.days) {
    const weather = rollWeather(course, rng);
    // After 14 blocked days an overcast day is declared dry enough; after 28 any day is, so a
    // round always finishes.
    const dryEnough =
      weather === 'dry_clear' ||
      (waiting >= cfg.maxExtraDays && weather === 'overcast') ||
      waiting >= 2 * cfg.maxExtraDays;
    if (dryEnough) {
      held += 1;
      days.push(make(index, weather, 'prelim', held));
    } else {
      waiting += 1;
      days.push(make(index, weather, 'gap', null));
    }
    index += 1;
  }
  return { days, finalDate: addDays(practiceStart, index) };
}
