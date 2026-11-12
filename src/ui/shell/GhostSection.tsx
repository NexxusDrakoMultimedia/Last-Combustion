// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import type { GhostPick, GhostResult } from '../../db/ghost';
import { formatLapTime, t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { field } from '../styles';

const seconds = (ms: number): string => (Math.abs(ms) / 1000).toFixed(3);

/** One line about how a ghost went, by what was picked and how the run compared. */
function resultLine(r: GhostResult): string {
  const who = { driver: r.driver, number: r.raceNumber };
  if (r.mode === 'easy') return t('ghost.result.easy', who);
  if (r.deltaMs === null || r.ghostName === null)
    return t('ghost.result.nothing', { ...who, ghost: r.ghostName ?? '' });
  const common = { ...who, ghost: r.ghostName, seconds: seconds(r.deltaMs) };
  return r.beaten ? t('ghost.result.beat', common) : t('ghost.result.lost', common);
}

/** The ghost record: a ghost for each entry before the prelims, and how the last ones went. */
export function GhostSection() {
  const { ghost, loadGhost, setGhostPick, status } = useCareerStore();
  useEffect(() => {
    loadGhost();
  }, [loadGhost]);
  const pick = (entryId: number, value: string) => {
    const choice: GhostPick | null =
      value === 'easy'
        ? { mode: 'easy' }
        : value.startsWith('hard:')
          ? { mode: 'hard', driverId: Number(value.slice(5)) }
          : null;
    void setGhostPick(entryId, choice);
  };
  return (
    <section className="space-y-2 text-sm">
      <h3 className="lc-display text-sm text-lc-dim">{t('ghost.title')}</h3>
      <p className="text-lc-dim">{t('ghost.intro')}</p>
      {!ghost.available ? (
        <p className="text-lc-dim">{t('ghost.none')}</p>
      ) : ghost.round === null ? (
        <p className="text-lc-dim">{t('ghost.done')}</p>
      ) : (
        <>
          <p>{t('ghost.round', { round: ghost.round })}</p>
          <ul className="space-y-2">
            {ghost.entries.map((e) => (
              <li key={e.entryId} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {t('ghost.entry', { number: e.raceNumber, driver: e.driver })}
                </span>
                <select
                  className={field}
                  disabled={status === 'busy'}
                  value={
                    e.pick === null
                      ? 'none'
                      : e.pick.mode === 'easy'
                        ? 'easy'
                        : `hard:${e.pick.driverId}`
                  }
                  onChange={(ev) => pick(e.entryId, ev.target.value)}
                >
                  <option value="none">{t('ghost.pick.none')}</option>
                  <option value="easy">{t('ghost.pick.easy')}</option>
                  {ghost.options.map((o) => (
                    <option key={o.driverId} value={`hard:${o.driverId}`}>
                      {t('ghost.pick.hard', { name: o.name, time: formatLapTime(o.timeMs) })}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
      {ghost.results.length > 0 && (
        <ul className="space-y-1 text-xs text-lc-dim">
          {ghost.results.map((r, i) => (
            <li key={`${r.raceNumber}-${i}`}>{resultLine(r)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
