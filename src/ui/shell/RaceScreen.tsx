// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import type { FeedLine, TowerRow } from '../../db/racewatch';
import { useCareerStore, type WatchStep } from '../../state/career.store';
import { button, dataTable, quiet } from '../styles';

/** Milliseconds between sectors while a race plays itself, at each speed. */
const SPEEDS: { id: 1 | 2 | 4; every: number }[] = [
  { id: 1, every: 900 },
  { id: 2, every: 450 },
  { id: 4, every: 150 },
];

const seconds = (n: number | null, digits = 2): string => (n === null ? '' : n.toFixed(digits));

function feedText(line: FeedLine): string {
  const p = line.payload;
  const base = {
    driver: line.driver,
    number: line.raceNumber,
    other: line.other ?? '',
    otherNumber: line.otherRaceNumber ?? 0,
    seconds: String(p.secondsLost ?? p.penaltySeconds ?? p.heldSeconds ?? ''),
    fromLap: Number(p.fromLap ?? 0) + 1,
    toLap: Number(p.toLap ?? 0) + 1,
    tyre: String(p.tyrePct ?? ''),
  };
  return t(`race.feed.${line.type}` as never, base);
}

function TyreBar({ pct }: { pct: number }) {
  const colour = pct >= 50 ? 'bg-lc-good' : pct >= 20 ? 'bg-lc-warn' : 'bg-lc-bad';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="meter"
        aria-label={t('race.col.tyres')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="inline-block h-1.5 w-14 bg-lc-line"
      >
        <span className={`block h-full ${colour}`} style={{ width: `${Math.max(0, pct)}%` }} />
      </span>
      <span className="lc-num text-xs">{Math.round(pct)}</span>
    </span>
  );
}

function Tower({ rows }: { rows: TowerRow[] }) {
  return (
    <table className={`${dataTable} text-sm`}>
      <caption className="sr-only">{t('race.tower')}</caption>
      <thead className="text-xs text-lc-dim">
        <tr>
          <th scope="col">{t('race.col.pos')}</th>
          <th scope="col">{t('race.col.no')}</th>
          <th scope="col">{t('race.col.driver')}</th>
          <th scope="col" className="text-right">
            {t('race.col.gap')}
          </th>
          <th scope="col" className="text-right">
            {t('race.col.int')}
          </th>
          <th scope="col" className="text-right">
            {t('race.col.last')}
          </th>
          <th scope="col">{t('race.col.tyres')}</th>
          <th scope="col">{t('race.col.call')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.entryId}
            className={`border-t border-lc-line ${r.mine ? 'bg-lc-raised font-semibold' : ''} ${
              r.retired ? 'text-lc-dim' : ''
            }`}
          >
            <td className="lc-num">{r.position ?? t('race.out')}</td>
            <td className="lc-num">{r.raceNumber}</td>
            <td>{r.driver}</td>
            <td className="lc-num text-right">
              {r.position === null
                ? ''
                : r.gapSeconds === null
                  ? t('race.leader')
                  : t('race.gap', { value: seconds(r.gapSeconds, 1) })}
            </td>
            <td className="lc-num text-right">
              {r.intervalSeconds === null
                ? ''
                : t('race.gap', { value: seconds(r.intervalSeconds, 1) })}
            </td>
            <td className="lc-num text-right">{r.retired ? '' : seconds(r.lastSectorSeconds)}</td>
            <td>{r.retired ? '' : <TyreBar pct={r.tyrePct} />}</td>
            <td>
              {r.retired
                ? t(`race.retired.${r.retired}` as never)
                : t(`race.call.${r.call}` as never)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The race screen: a final being watched, with its timing tower, what is happening and the controls. */
export function RaceScreen() {
  const finalWatch = useCareerStore((s) => s.finalWatch);
  const calendar = useCareerStore((s) => s.calendar);
  const final = useCareerStore((s) => s.final);
  const status = useCareerStore((s) => s.status);
  const watchFinal = useCareerStore((s) => s.watchFinal);
  const stepFinalWatch = useCareerStore((s) => s.stepFinalWatch);
  // `playFrom` is the sector the player pressed Play at (null when paused).
  const [playFrom, setPlayFrom] = useState<number | null>(null);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const busy = status === 'busy';

  // A race that plays itself: one sector at a time, until the player pauses it, an incident the race
  // stops for happens after Play was pressed, or the flag falls (which ends the watch).
  const progress = finalWatch?.progress ?? -1;
  const lastPlayed = progress - 1;
  const newest = finalWatch?.feed[0];
  const incidentStopped =
    finalWatch !== null &&
    playFrom !== null &&
    lastPlayed >= playFrom &&
    !!newest?.pause &&
    newest.lap === Math.floor(lastPlayed / finalWatch.sectorCount) + 1 &&
    newest.sector === (lastPlayed % finalWatch.sectorCount) + 1;
  const playing = playFrom !== null && finalWatch !== null && !incidentStopped;
  useEffect(() => {
    if (!playing || busy) return;
    const every = SPEEDS.find((s) => s.id === speed)?.every ?? 900;
    const timer = setTimeout(() => void stepFinalWatch('sector'), every);
    return () => clearTimeout(timer);
  }, [playing, speed, progress, busy, stepFinalWatch]);

  if (!finalWatch) {
    const due = calendar?.due?.kind === 'final';
    if (final && !due)
      return (
        <div className="space-y-2 text-sm">
          <p className="lc-display">{t('race.over')}</p>
          {final.podium[0] && (
            <p>
              {t('race.winner', {
                driver: final.podium[0].driver,
                number: final.podium[0].raceNumber,
              })}
            </p>
          )}
          <p className="text-lc-dim">{t('race.overHint')}</p>
        </div>
      );
    return (
      <div className="space-y-3 text-sm">
        <p className="text-lc-dim">{due ? t('race.waiting') : t('race.nothing')}</p>
        {due && (
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => void watchFinal()}
          >
            {t('race.watch')}
          </button>
        )}
      </div>
    );
  }

  const step = (mode: WatchStep) => () => {
    setPlayFrom(null);
    void stepFinalWatch(mode);
  };
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="lc-num">
          {t('race.lap', {
            lap: finalWatch.lap,
            laps: finalWatch.laps,
            sector: finalWatch.sector,
            sectors: finalWatch.sectorCount,
          })}
        </p>
        <p className={finalWatch.wet ? 'text-lc-warn' : 'text-lc-dim'}>
          {finalWatch.wet
            ? t('race.wet')
            : finalWatch.weather
              ? t('race.rainComing', { lap: finalWatch.weather.startLap + 1 })
              : t('race.dry')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={busy}
          aria-pressed={playing}
          onClick={() => setPlayFrom(playing ? null : progress)}
        >
          {playing ? t('race.pause') : t('race.play')}
        </button>
        <label className="flex items-center gap-1 text-lc-dim">
          {t('race.speed')}
          <select
            className="border border-lc-line bg-lc-raised p-1 text-lc-text"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as 1 | 2 | 4)}
          >
            {SPEEDS.map((s) => (
              <option key={s.id} value={s.id}>
                {t('race.speedValue', { n: s.id })}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={quiet} disabled={busy} onClick={step('sector')}>
          {t('race.next.sector')}
        </button>
        <button type="button" className={quiet} disabled={busy} onClick={step('lap')}>
          {t('race.next.lap')}
        </button>
        <button type="button" className={quiet} disabled={busy} onClick={step('incident')}>
          {t('race.next.incident')}
        </button>
        <button type="button" className={quiet} disabled={busy} onClick={step('end')}>
          {t('race.next.end')}
        </button>
      </div>
      <Tower rows={finalWatch.rows} />
      <section className="space-y-1">
        <h3 className="lc-display text-sm text-lc-dim">{t('race.feed')}</h3>
        {finalWatch.feed.length === 0 ? (
          <p className="text-lc-dim">{t('race.feedEmpty')}</p>
        ) : (
          <ul className="space-y-1">
            {finalWatch.feed.map((line, i) => (
              <li
                key={`${line.lap}-${line.sector}-${i}`}
                className={line.mine ? 'font-semibold' : ''}
              >
                <span className="lc-num text-lc-dim">
                  {t('race.feedWhen', { lap: line.lap, sector: line.sector })}
                </span>{' '}
                {feedText(line)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
