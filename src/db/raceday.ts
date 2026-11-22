// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { bringForwardTo, calendarView } from './calendar';
import {
  playPrelimDay,
  playPrelimRuns,
  prelimsStarted,
  startPrelims,
  type PrelimProgress,
} from './prelims';

/**
 * Plays the next prelim day of a round on that day's date: the prelims are started first if they have
 * not been (on the date they open), and the game date is brought forward to the day, so everything that
 * happens between days (the delivery work, training, the press) happens on the days it belongs to.
 */
export function playNextPrelimDay(db: Database, roundNumber: number): PrelimProgress {
  startAndBringToTheDay(db, roundNumber);
  return playPrelimDay(db, roundNumber);
}

/** Starts the prelims if they have not been, and brings the game date to the prelim day that is next. */
function startAndBringToTheDay(db: Database, roundNumber: number): void {
  if (!prelimsStarted(db, roundNumber)) {
    bringForwardTo(db, 'prelims', roundNumber);
    startPrelims(db, roundNumber);
  }
  const next = calendarView(db)?.events.find(
    (e) => e.kind === 'prelim_day' && e.round === roundNumber && !e.done,
  );
  if (next) bringForwardTo(db, 'prelim_day', roundNumber, next.day);
}

/** How far a step of the prelims goes: one run, ten, the rest of the day, or the rest of the prelims. */
export type PrelimStep = 'run' | 'runs' | 'day' | 'end';

const RUNS_PER_STEP: Record<PrelimStep, number> = {
  run: 1,
  runs: 10,
  day: Number.MAX_SAFE_INTEGER,
  end: Number.MAX_SAFE_INTEGER,
};

/**
 * Plays on in the prelims a run at a time (starting them if need be), each run on its prelim day's date.
 * A step never goes past the end of its day, except to the end of the prelims, which goes on day after day.
 */
export function stepPrelims(db: Database, roundNumber: number, step: PrelimStep): PrelimProgress {
  for (;;) {
    startAndBringToTheDay(db, roundNumber);
    const progress = playPrelimRuns(db, roundNumber, RUNS_PER_STEP[step]);
    if (progress.summary || step !== 'end') return progress;
  }
}

/** Plays every prelim day still to come, one after the other, each on its own date. */
export function playPrelimsOnTheDays(db: Database, roundNumber: number) {
  for (;;) {
    const progress = playNextPrelimDay(db, roundNumber);
    if (progress.summary) return progress.summary;
  }
}
