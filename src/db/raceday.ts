// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { Database } from 'sql.js';
import { bringForwardTo, calendarView } from './calendar';
import { playPrelimDay, prelimsStarted, startPrelims, type PrelimProgress } from './prelims';

/**
 * Plays the next prelim day of a round on that day's date: the prelims are started first if they have
 * not been (on the date they open), and the game date is brought forward to the day, so everything that
 * happens between days (the delivery work, training, the press) happens on the days it belongs to.
 */
export function playNextPrelimDay(db: Database, roundNumber: number): PrelimProgress {
  if (!prelimsStarted(db, roundNumber)) {
    bringForwardTo(db, 'prelims', roundNumber);
    startPrelims(db, roundNumber);
  }
  const next = calendarView(db)?.events.find(
    (e) => e.kind === 'prelim_day' && e.round === roundNumber && !e.done,
  );
  if (next) bringForwardTo(db, 'prelim_day', roundNumber, next.day);
  return playPrelimDay(db, roundNumber);
}

/** Plays every prelim day still to come, one after the other, each on its own date. */
export function playPrelimsOnTheDays(db: Database, roundNumber: number) {
  for (;;) {
    const progress = playNextPrelimDay(db, roundNumber);
    if (progress.summary) return progress.summary;
  }
}
