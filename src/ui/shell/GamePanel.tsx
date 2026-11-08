// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatDate, formatLapTime, formatMoney, t } from '../../i18n';
import type { ChronicleLine } from '../../db/gameinfo';
import { useCareerStore } from '../../state/career.store';
import { dataTable } from '../styles';

type Row = [label: string, value: string];

function Facts({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="space-y-1">
      <h3 className="lc-display text-sm text-lc-dim">{title}</h3>
      <table className={`${dataTable} text-sm`}>
        <caption className="sr-only">{title}</caption>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-t border-lc-line">
              <th scope="row" className="w-1/2 py-1 text-left font-normal text-lc-dim">
                {label}
              </th>
              <td className="lc-num">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const number = (n: number): string => n.toLocaleString('en-AU');

function line(l: ChronicleLine): string {
  const v = l.values;
  if (l.kind === 'death')
    return t('game.chronicle.death', {
      role: t(`death.role.${String(v.type)}` as never),
      name: String(v.name),
      cause: t(`death.cause.${String(v.cause)}` as never),
    });
  if (l.kind === 'champion')
    return t('game.chronicle.champion', {
      driver: String(v.driver),
      garage: String(v.garage),
      year: Number(v.year),
    });
  return t('game.chronicle.win', { driver: String(v.driver), course: String(v.course) });
}

/** The Game screen: facts about this save, the world, the series and the garage, and a dated chronicle. */
export function GamePanel({ tab }: { tab: string }) {
  const view = useCareerStore((s) => s.gameView);
  if (!view) return null;
  const { facts, world, series, you, chronicle } = view;

  if (tab === 'world')
    return (
      <div className="space-y-6">
        <Facts
          title={t('game.section.world')}
          rows={(
            [
              'garages',
              'drivers',
              'retiredDrivers',
              'cars',
              'manufacturers',
              'models',
              'sponsors',
              'suppliers',
              'courses',
              'nations',
              'places',
              'mechanics',
              'executives',
              'shareholders',
            ] as const
          ).map((k): Row => [t(`game.world.${k}`), number(world[k])])}
        />
      </div>
    );

  if (tab === 'series')
    return (
      <div className="space-y-6">
        <Facts
          title={t('game.section.series')}
          rows={[
            [t('game.series.seasons'), number(series.seasons)],
            [t('game.series.seasonsComplete'), number(series.seasonsComplete)],
            [t('game.series.rounds'), number(series.rounds)],
            [t('game.series.roundsRun'), number(series.roundsRun)],
            [t('game.series.classified'), number(series.classified)],
            [t('game.series.distanceKm'), t('game.km', { value: number(series.distanceKm) })],
            [t('game.series.prizeMoney'), formatMoney(series.prizeMoney)],
            [
              t('game.series.fastestPrelim'),
              series.fastestPrelim
                ? t('game.series.fastestPrelimValue', {
                    time: formatLapTime(series.fastestPrelim.ms),
                    driver: series.fastestPrelim.driver,
                    year: series.fastestPrelim.year,
                  })
                : t('game.series.none'),
            ],
            [t('game.series.deaths'), number(series.deaths)],
          ]}
        />
        <Facts
          title={t('game.section.you')}
          rows={[
            [t('game.you.titles'), number(you.titles)],
            [t('game.you.wins'), number(you.wins)],
            [t('game.you.podiums'), number(you.podiums)],
            [t('game.you.poles'), number(you.poles)],
            [t('game.you.races'), number(you.races)],
            [t('game.you.points'), number(you.points)],
            [t('game.you.prizeMoney'), formatMoney(you.prizeMoney)],
          ]}
        />
      </div>
    );

  if (tab === 'chronicle')
    return chronicle.length === 0 ? (
      <p className="text-sm text-lc-dim">{t('game.chronicle.none')}</p>
    ) : (
      <ul className="space-y-1 text-sm">
        {chronicle.map((l, i) => (
          <li key={`${l.date}-${i}`} className="flex gap-3 border-t border-lc-line py-1">
            <span className="lc-num w-32 shrink-0 text-lc-dim">{formatDate(l.date)}</span>
            <span>{line(l)}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <Facts
      title={t('game.section.facts')}
      rows={[
        [t('game.fact.garage'), facts.garage],
        [t('game.fact.owner'), facts.owner],
        [t('game.fact.mode'), t(`mode.${facts.mode}` as never)],
        [t('game.fact.difficulty'), t(`game.difficulty.${facts.difficulty}` as never)],
        [t('game.fact.seed'), facts.masterSeed],
        [t('game.fact.startYear'), String(facts.startYear)],
        [t('game.fact.date'), formatDate(facts.gameDate)],
        [t('game.fact.daysPlayed'), number(facts.daysPlayed)],
        [t('game.fact.version'), facts.appVersion],
        [t('game.fact.schema'), String(facts.schemaVersion)],
      ]}
    />
  );
}
