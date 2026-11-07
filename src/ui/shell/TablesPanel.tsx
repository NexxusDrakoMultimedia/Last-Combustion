// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState } from 'react';
import { formatDate, formatGap, formatLapTime, formatMoney, formatPoints, t } from '../../i18n';
import { TABLE_KINDS, type ResultRow, type TableKind } from '../../db/tables';
import { useCareerStore } from '../../state/career.store';
import { AttnFlag } from '../AttnFlag';
import { Flag } from '../Flag';
import { RegistryLink } from '../RegistryLink';
import { Plate } from '../Plate';
import { RaceNumber } from '../RaceNumber';
import { dataTable, field, quiet } from '../styles';

const mine = 'bg-lc-raised font-medium';

/** The season to look at: the newest one is first. */
function SeasonSelect({
  id,
  year,
  onYear,
}: {
  id: string;
  year: number;
  onYear: (y: number) => void;
}) {
  const years = useCareerStore((s) => s.years);
  return (
    <label className="space-y-1 text-sm" htmlFor={id}>
      {t('tables.season')}
      <select
        id={id}
        className={field}
        value={year}
        onChange={(e) => onYear(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Every championship table of a season, in full: all drivers, garages, manufacturers and nations. */
export function StandingsPanel() {
  const { hub, standingsView, loadStandings } = useCareerStore();
  const [year, setYear] = useState(hub?.year ?? 0);
  const [kind, setKind] = useState<TableKind>('drivers');
  useEffect(() => {
    if (year > 0) loadStandings(year);
  }, [year, loadStandings, hub?.rounds]);
  if (!standingsView || standingsView.year !== year) return null;
  const rows = standingsView.tables[kind];
  const scored = standingsView.rounds > 0;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <SeasonSelect id="standings-season" year={year} onYear={setYear} />
        <label className="space-y-1" htmlFor="standings-kind">
          {t('tables.championship')}
          <select
            id="standings-kind"
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value as TableKind)}
          >
            {TABLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`tables.kind.${k}` as never)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-lc-dim">
        {t('tables.summary', {
          count: rows.length,
          rounds: standingsView.rounds,
          total: standingsView.roundsTotal,
        })}
      </p>
      {!scored ? (
        <p className="text-lc-dim">{t('hub.tableEmpty')}</p>
      ) : (
        <div>
          <table className={dataTable}>
            <caption className="sr-only">{t(`tables.kind.${kind}` as never)}</caption>
            <thead className="lc-display sticky top-0 bg-lc-panel text-xs text-lc-dim">
              <tr>
                <th scope="col">{t('hub.rank')}</th>
                <th scope="col">{t(`tables.name.${kind}` as never)}</th>
                {(kind === 'drivers' || kind === 'manufacturers') && (
                  <th scope="col">{t(`tables.detail.${kind}` as never)}</th>
                )}
                <th scope="col" className="text-right">
                  {t('hub.points')}
                </th>
                <th scope="col" className="text-right">
                  {t('hub.wins')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.rank}-${r.name}`}
                  className={`border-t border-lc-line ${r.mine ? mine : ''}`}
                >
                  <td className="lc-num py-1">{r.rank}</td>
                  <td>
                    {r.driverId > 0 ? (
                      <span className="inline-flex items-center gap-2">
                        <RaceNumber number={r.raceNumber} badge={r.badge} />
                        <RegistryLink to={{ kind: 'driver', id: r.driverId }}>
                          {r.name}
                        </RegistryLink>
                      </span>
                    ) : r.garageId > 0 && kind === 'garages' ? (
                      <RegistryLink to={{ kind: 'garage', id: r.garageId }}>{r.name}</RegistryLink>
                    ) : r.flag ? (
                      <span className="inline-flex items-center gap-2">
                        <Flag code={r.flag} />
                        {r.name}
                      </span>
                    ) : (
                      r.name
                    )}
                  </td>
                  {(kind === 'drivers' || kind === 'manufacturers') && (
                    <td className="text-lc-dim">
                      {kind === 'drivers' && r.garageId > 0 ? (
                        <RegistryLink to={{ kind: 'garage', id: r.garageId }}>
                          {r.detail}
                        </RegistryLink>
                      ) : (
                        r.detail
                      )}
                    </td>
                  )}
                  <td className="lc-num text-right">{formatPoints(r.points)}</td>
                  <td className="lc-num text-right">{r.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const timeCell = (r: ResultRow): string =>
  r.timeMs === null ? (r.dnf ? t('tables.dnf', { reason: r.dnf }) : '') : formatLapTime(r.timeMs);

/** The full classification of a round: every car's prelim and the whole final. */
export function ResultsPanel() {
  const { hub, classificationView, standingsView, loadClassification, loadStandings } =
    useCareerStore();
  // A link to a round's results (from the calendar) lands here on that round and session.
  const focus = useCareerStore((s) => s.resultsFocus);
  const [year, setYear] = useState(focus?.year ?? hub?.year ?? 0);
  const [round, setRound] = useState(() => {
    if (focus) return focus.round;
    const done = hub?.rounds.filter((r) => r.status !== 'scheduled') ?? [];
    return done.length > 0 ? done[done.length - 1]!.number : 1;
  });
  const [session, setSession] = useState<'prelims' | 'final'>(focus?.session ?? 'final');
  useEffect(() => {
    if (year > 0) {
      loadStandings(year);
      loadClassification(year, round);
    }
  }, [year, round, loadClassification, loadStandings, hub?.rounds]);
  const total = standingsView?.year === year ? standingsView.roundsTotal : 6;
  const c = classificationView;
  const ready = c && c.year === year && c.round === round;
  const rows = ready ? (session === 'final' ? c.final : c.prelims) : [];
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <SeasonSelect id="results-season" year={year} onYear={setYear} />
        <label className="space-y-1" htmlFor="results-round">
          {t('tables.round')}
          <select
            id="results-round"
            className={field}
            value={round}
            onChange={(e) => setRound(Number(e.target.value))}
          >
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2" role="group" aria-label={t('tables.session')}>
          {(['prelims', 'final'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={quiet}
              aria-pressed={session === s}
              onClick={() => setSession(s)}
            >
              {t(`tables.session.${s}` as never)}
            </button>
          ))}
        </div>
      </div>
      {ready && (
        <div className="space-y-2">
          <p className="text-lc-dim">
            {t('tables.roundLine', { round: c.round, course: c.course, count: rows.length })}
          </p>
          <p className="text-lc-dim">
            {t('tables.roundDates', {
              practice: formatDate(c.practiceStart),
              prelims: formatDate(c.prelimStart),
              final: formatDate(c.finalDate),
            })}
          </p>
          {c.days.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label={t('tables.conditions')}>
              {c.days.map((d) => (
                <li key={d.date} className="border border-lc-line p-2">
                  <span className="lc-num block">{formatDate(d.date)}</span>
                  <span className="text-lc-dim">
                    {t('tables.dayLine', {
                      kind: t(`tables.day.${d.kind}` as never),
                      weather: t(`tables.weather.${d.weather}` as never),
                      temp: Math.round(d.temperatureC),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {ready && rows.length === 0 ? (
        <p className="text-lc-dim">{t('tables.notRun')}</p>
      ) : (
        <div>
          <table className={dataTable}>
            <caption className="sr-only">{t(`tables.session.${session}` as never)}</caption>
            <thead className="lc-display sticky top-0 bg-lc-panel text-xs text-lc-dim">
              <tr>
                <th scope="col">{t('tables.pos')}</th>
                <th scope="col" className="w-2/5">
                  {t('tables.entry')}
                </th>
                <th scope="col" className="w-1/4">
                  {t('tables.car')}
                </th>
                <th scope="col">{t('tables.time')}</th>
                <th scope="col">{t('tables.gap')}</th>
                <th scope="col" className="text-right">
                  {t('hub.points')}
                </th>
                {session === 'final' && (
                  <th scope="col" className="text-right">
                    {t('tables.prize')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.raceNumber}`}
                  className={`border-t border-lc-line ${r.mine ? mine : ''}`}
                >
                  <td className="lc-num py-1 align-middle">{r.position ?? t('tables.none')}</td>
                  <td className="align-middle">
                    <span className="flex items-center gap-2">
                      <RaceNumber number={r.raceNumber} badge={r.badge} />
                      <span className="flex flex-col">
                        <span className="flex items-center gap-2">
                          <RegistryLink to={{ kind: 'driver', id: r.driverId }}>
                            {r.driver}
                          </RegistryLink>
                          {r.attention && <AttnFlag />}
                        </span>
                        <span className="text-lc-dim">
                          <RegistryLink to={{ kind: 'garage', id: r.garageId }}>
                            {r.garage}
                          </RegistryLink>
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="min-w-28 py-2 align-middle">
                    <span className="flex flex-col gap-1 text-lc-dim">
                      <span>{r.car}</span>
                      <span>
                        <Plate plate={r.plate} state={r.plateState} carId={r.carId} />
                      </span>
                    </span>
                  </td>
                  <td className="lc-num align-middle">{timeCell(r)}</td>
                  <td className="lc-num align-middle">
                    {r.gapMs !== null && r.gapMs > 0 ? formatGap(r.gapMs) : ''}
                  </td>
                  <td className="lc-num text-right align-middle">
                    {r.points > 0 ? formatPoints(r.points) : ''}
                  </td>
                  {session === 'final' && (
                    <td className="lc-num text-right align-middle">
                      {r.prize > 0 ? formatMoney(r.prize) : ''}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
