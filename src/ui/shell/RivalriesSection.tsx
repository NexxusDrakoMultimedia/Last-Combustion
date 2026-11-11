// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import { t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';

/** The live rivalries of the player's drivers, with the meetings that built each one. */
export function RivalriesSection() {
  const { rivalries, loadRivalries } = useCareerStore();
  useEffect(() => {
    loadRivalries();
  }, [loadRivalries]);
  return (
    <section className="space-y-2 text-sm">
      <h3 className="lc-display text-sm text-lc-dim">{t('rivalry.title')}</h3>
      <p className="text-lc-dim">{t('rivalry.intro')}</p>
      {rivalries.length === 0 ? (
        <p className="text-lc-dim">{t('rivalry.none')}</p>
      ) : (
        <ul className="space-y-2">
          {rivalries.map((r) => (
            <li
              key={`${r.driverId}-${r.rivalId}`}
              className="space-y-1 border border-lc-line bg-lc-raised p-2"
            >
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {t('rivalry.pair', { driver: r.driverName, rival: r.rivalName })}
                </span>
                <span>{t(`rivalry.level.${r.level}`)}</span>
              </p>
              <p className="text-xs text-lc-dim">
                {t('rivalry.since', { year: r.startedYear, heat: Math.round(r.heat) })}
              </p>
              <ul className="text-xs text-lc-dim">
                {r.meetings.map((m, i) => (
                  <li key={i}>
                    {t(`rivalry.meeting.${m.kind}`, { round: m.round, year: m.year })}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
