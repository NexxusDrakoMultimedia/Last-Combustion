// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatDate, formatLapTime, formatMoney, t, type MessageKey } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { StarterChoice } from '../StarterChoice';
import { button, quiet } from '../styles';
import { Panel } from './Panel';
import {
  ConditionBar,
  DriversTable,
  MenuActions,
  OwnedCars,
  SeasonCalendar,
  UsedMarket,
} from './panels';

type PanelId = 'season' | 'garage' | 'market' | 'menu';

const RAIL: { id: PanelId | null; label: MessageKey }[] = [
  { id: 'season', label: 'rail.season' },
  { id: 'garage', label: 'rail.garage' },
  { id: 'market', label: 'rail.market' },
  { id: null, label: 'rail.upgrades' },
  { id: null, label: 'rail.staff' },
  { id: null, label: 'rail.sponsors' },
  { id: null, label: 'rail.money' },
];

/** The game shell: a top bar, a rail of panels, the garage floor and the news strip. */
export function Shell() {
  const s = useCareerStore();
  const {
    hub,
    starter,
    status,
    nextRound,
    nextFinal,
    prelims,
    final,
    seasonEnd,
    rollover,
    notice,
  } = s;
  const [open, setOpen] = useState<PanelId | null>(null);
  const [seasonTab, setSeasonTab] = useState('calendar');
  const [marketTab, setMarketTab] = useState('market');
  if (!hub) return null;

  const busy = status === 'busy';
  const allDone = hub.rounds.every((r) => r.status === 'complete');
  const ended = hub.seasonStatus === 'complete';
  const next = hub.rounds.find((r) => r.status !== 'complete');

  // The one thing to do next, as a single button in the top bar.
  const action: { label: MessageKey; run: () => void } | null =
    starter !== undefined
      ? null
      : nextFinal !== null
        ? { label: 'hub.runFinal', run: () => void s.runNextFinal() }
        : nextRound !== null
          ? { label: 'hub.runPrelims', run: () => void s.runNextPrelims() }
          : allDone && !ended
            ? { label: 'hub.endSeason', run: () => void s.finishSeason() }
            : ended
              ? { label: 'hub.nextSeason', run: () => void s.newSeason() }
              : null;

  const player = hub.player;
  const locked = starter !== undefined;
  const news: string[] = [];
  if (prelims)
    news.push(
      t('hub.prelims', {
        round: prelims.roundNumber,
        finishers: prelims.finishers,
        qualifiers: prelims.qualifiers,
        pole: prelims.top[0]
          ? t('hub.pole', {
              number: prelims.top[0].raceNumber,
              driver: prelims.top[0].driver,
              time: formatLapTime(prelims.top[0].timeMs),
            })
          : '',
      }),
    );
  if (final)
    news.push(
      t('hub.final', {
        round: final.roundNumber,
        finishers: final.finishers,
        winner: final.podium[0]
          ? t('hub.winner', { number: final.podium[0].raceNumber, driver: final.podium[0].driver })
          : '',
      }),
    );
  if (seasonEnd)
    news.push(
      t('hub.seasonEnd', { year: seasonEnd.year, prize: formatMoney(seasonEnd.prizePaid) }),
    );
  if (hub.championName) news.push(t('hub.champion', { name: hub.championName }));
  if (rollover)
    news.push(
      t('hub.rollover', {
        year: rollover.year,
        retired: rollover.retired,
        rookies: rollover.rookies,
      }),
    );
  if (notice) news.push(t(notice.key, notice.values));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-lc-line bg-lc-panel px-4 py-2">
        <div>
          <p className="lc-display text-lg leading-tight">
            {player?.garageName ?? t('hub.noGarage')}
          </p>
          <p className="lc-display text-xs text-lc-dim">{t('shell.year', { year: hub.year })}</p>
        </div>
        <div>
          <p className="lc-display text-xs text-lc-dim">{t('shell.balance')}</p>
          <p className="lc-num text-lg text-lc-good">{formatMoney(player?.cash ?? 0)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="lc-display text-xs text-lc-dim">{t('shell.upcoming')}</p>
          <p className="truncate text-sm">
            {next
              ? t('shell.nextRound', {
                  round: next.number,
                  course: next.course,
                  date: formatDate(next.finalDate),
                })
              : t('shell.noRounds')}
          </p>
        </div>
        {action && (
          <button type="button" className={button} disabled={busy} onClick={action.run}>
            {t(action.label)}
          </button>
        )}
        <button type="button" className={quiet} onClick={() => setOpen('menu')}>
          {t('shell.menu')}
        </button>
      </header>

      <div className="flex flex-1">
        <main className="flex-1 space-y-4 p-4">
          <h2 className="lc-display text-sm text-lc-dim">{t('shell.floor')}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {player?.entries.map((e) => {
              const car = s.cars.find((c) => c.inEntry === e.raceNumber);
              return (
                <li key={e.raceNumber} className="border border-lc-line bg-lc-panel p-3">
                  <p className="lc-display text-3xl text-lc-accent-ink">
                    {t('shell.number', { number: e.raceNumber })}
                  </p>
                  <p className="text-sm font-medium">{e.driver}</p>
                  <p className="text-sm text-lc-dim">{e.car}</p>
                  {car && <ConditionBar wear={car.wear} />}
                </li>
              );
            })}
          </ul>
          <section aria-label={t('shell.news')} className="space-y-1 border-t border-lc-line pt-3">
            <h2 className="lc-display text-sm text-lc-dim">{t('shell.news')}</h2>
            <ul className="space-y-1 text-sm" aria-live="polite">
              {news.length === 0 && <li className="text-lc-dim">{t('shell.noNews')}</li>}
              {news.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        </main>
        <nav
          aria-label={t('shell.rail')}
          className="flex w-24 flex-col border-l border-lc-line bg-lc-panel"
        >
          {RAIL.map((r) => (
            <button
              key={r.label}
              type="button"
              disabled={r.id === null}
              title={r.id === null ? t('shell.soon') : undefined}
              className={`lc-display border-b border-lc-line px-2 py-3 text-xs hover:bg-lc-raised focus-visible:outline-2 focus-visible:outline-lc-accent-ink disabled:opacity-40 disabled:hover:bg-transparent ${
                open === r.id ? 'text-lc-accent-ink' : ''
              }`}
              onClick={() => r.id && setOpen(r.id)}
            >
              {t(r.label)}
            </button>
          ))}
        </nav>
      </div>

      {starter !== undefined && (
        <Panel title={t('starter.heading')} subtitle={t('starter.intro')}>
          <StarterChoice />
        </Panel>
      )}
      {!locked && open === 'season' && (
        <Panel
          title={t('hub.season', { year: hub.year })}
          tabs={[
            { id: 'calendar', label: t('hub.calendar') },
            { id: 'table', label: t('hub.table') },
          ]}
          tab={seasonTab}
          onTab={setSeasonTab}
          onClose={() => setOpen(null)}
        >
          {seasonTab === 'calendar' ? <SeasonCalendar /> : <DriversTable />}
        </Panel>
      )}
      {!locked && open === 'garage' && (
        <Panel
          title={t('market.cars')}
          subtitle={
            player
              ? t('hub.garageLine', {
                  owner: player.ownerName,
                  cash: formatMoney(player.cash),
                  prestige: player.prestige,
                  fans: player.fans,
                })
              : undefined
          }
          onClose={() => setOpen(null)}
        >
          <OwnedCars locked={locked} />
        </Panel>
      )}
      {!locked && open === 'market' && (
        <Panel
          title={t('rail.market')}
          tabs={[
            { id: 'market', label: t('market.heading') },
            { id: 'cars', label: t('market.cars') },
          ]}
          tab={marketTab}
          onTab={setMarketTab}
          onClose={() => setOpen(null)}
        >
          {marketTab === 'market' ? <UsedMarket locked={locked} /> : <OwnedCars locked={locked} />}
        </Panel>
      )}
      {open === 'menu' && (
        <Panel title={t('shell.menu')} onClose={() => setOpen(null)}>
          <MenuActions />
        </Panel>
      )}
    </div>
  );
}
