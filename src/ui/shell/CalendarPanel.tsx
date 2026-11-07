// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatDate, t } from '../../i18n';
import type { CalendarEvent } from '../../sim/calendar';
import { useCareerStore } from '../../state/career.store';

const MS_PER_DAY = 86_400_000;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

const eventName = (e: CalendarEvent): string =>
  e.kind === 'occasion'
    ? t('calendar.event.occasion', { occasion: t(`social.occasion.${e.occasion}` as never) })
    : t(`calendar.event.${e.kind}` as never, { round: e.round ?? 0 });

/** The calendar: today, what is waiting, what is coming and what has been. */
export function CalendarPanel() {
  const calendar = useCareerStore((s) => s.calendar);
  if (!calendar) return <p className="text-sm text-lc-dim">{t('calendar.none')}</p>;
  const upcoming = calendar.events.filter((e) => !e.done);
  const past = calendar.events.filter((e) => e.done).slice(-8);
  const when = (e: CalendarEvent): string => {
    const days = daysBetween(calendar.date, e.date);
    if (days <= 0) return t('calendar.todayShort');
    return days === 1 ? t('calendar.tomorrow') : t('calendar.in', { days });
  };
  return (
    <div className="space-y-6 text-sm">
      <p className="lc-num">{t('calendar.today', { date: formatDate(calendar.date) })}</p>
      <p>
        {calendar.due
          ? t('calendar.due', { event: eventName(calendar.due) })
          : t('calendar.nothingDue')}
      </p>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('calendar.upcoming')}</h3>
        <ul className="space-y-1">
          {upcoming.slice(0, 10).map((e) => (
            <li
              key={`${e.kind}-${e.round ?? 0}-${e.occasion ?? ''}`}
              className="flex flex-wrap gap-x-3 border-t border-lc-line py-1"
            >
              <span className="lc-num w-32 text-lc-dim">{formatDate(e.date)}</span>
              <span className="flex-1">{eventName(e)}</span>
              <span className="text-lc-dim">{when(e)}</span>
            </li>
          ))}
        </ul>
      </section>
      {past.length > 0 && (
        <section className="space-y-2">
          <h3 className="lc-display text-sm text-lc-dim">{t('calendar.past')}</h3>
          <ul className="space-y-1">
            {past.map((e) => (
              <li
                key={`${e.kind}-${e.round ?? 0}-${e.occasion ?? ''}`}
                className="flex gap-x-3 border-t border-lc-line py-1 text-lc-dim"
              >
                <span className="lc-num w-32">{formatDate(e.date)}</span>
                <span>{eventName(e)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
