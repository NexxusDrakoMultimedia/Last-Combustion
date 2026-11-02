// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { courses } from './data';
import type { RoundDates } from './types';

/** Days from the first practice day of one round to the first of the next: 15 days plus a three-week gap. */
export const ROUND_SLOT_DAYS = 36;

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The season calendar (see the GDD, "Season calendar & Timeline"). Round 1 practice opens on
 * 31 March, prelims start 7 days later and the final is the day after the 7 prelim days.
 */
export function buildCalendar(year: number): RoundDates[] {
  return courses.map((course, index) => {
    const practiceStart = addDays(`${year}-03-31`, index * ROUND_SLOT_DAYS);
    return {
      number: course.number,
      courseId: course.id,
      practiceStart,
      prelimStart: addDays(practiceStart, 7),
      finalDate: addDays(practiceStart, 14),
    };
  });
}
