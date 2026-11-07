// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { trackDesign } from '../../platform/telemetry';
import { formatDate, formatLapTime, formatMoney, t, type MessageKey } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { StarterChoice } from '../StarterChoice';
import { button, quiet } from '../styles';
import { DriversPanel } from './DriversPanel';
import { Panel } from './Panel';
import { AuctionSection } from './AuctionSection';
import { DealerSection } from './DealerSection';
import { EntriesSection } from './EntriesSection';
import { LedgerPanel } from './LedgerPanel';
import { SponsorsPanel } from './SponsorsPanel';
import { SupplyPanel } from './SupplyPanel';
import { About, FeedbackLink } from '../About';
import { EntityFlag } from '../Flag';
import { Plate } from '../Plate';
import { RaceNumber } from '../RaceNumber';
import { RegistryLink } from '../RegistryLink';
import { AlmanacPanel } from './AlmanacPanel';
import { RegistryPanel } from './RegistryPanel';
import { ResultsPanel, StandingsPanel } from './TablesPanel';
import { ExecutivesSection } from './ExecutivesSection';
import { StaffPanel } from './StaffPanel';
import { UpgradesPanel } from './UpgradesPanel';
import { FacilitiesSection } from './FacilitiesSection';
import { ConditionBar, MenuActions, OwnedCars, SeasonCalendar, UsedMarket } from './panels';

type PanelId =
  | 'season'
  | 'garage'
  | 'market'
  | 'upgrades'
  | 'drivers'
  | 'staff'
  | 'operations'
  | 'sponsors'
  | 'almanac'
  | 'registry'
  | 'money'
  | 'menu';

const RAIL: { id: PanelId | null; label: MessageKey }[] = [
  { id: 'season', label: 'rail.season' },
  { id: 'garage', label: 'rail.garage' },
  { id: 'market', label: 'rail.market' },
  { id: 'upgrades', label: 'rail.upgrades' },
  { id: 'drivers', label: 'rail.drivers' },
  { id: 'staff', label: 'rail.staff' },
  { id: 'operations', label: 'rail.operations' },
  { id: 'sponsors', label: 'rail.sponsors' },
  { id: 'almanac', label: 'rail.almanac' },
  { id: 'registry', label: 'rail.registry' },
  { id: 'money', label: 'rail.money' },
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
  const [openPanel, setPanel] = useState<PanelId | null>(null);
  // A profile opened from anywhere (a plate, a name, a number) shows the Registry over whatever is open.
  const open = s.registryPage ? 'registry' : openPanel;
  const [seasonTab, setSeason] = useState('calendar');
  const [marketTab, setMarket] = useState('market');
  const [staffTab, setStaff] = useState('mechanics');
  const [operationsTab, setOperationsTab] = useState('suppliers');
  const [almanacTab, setAlmanac] = useState('seasons');
  /** Opens or closes a panel, counting which panels are used. */
  const setOpen = (id: PanelId | null) => {
    if (id !== null) trackDesign(undefined, 'Panel', 'Open', id);
    if (id === 'registry') {
      s.openRegistry({ kind: 'index' });
      return;
    }
    if (id === 'almanac') s.loadRecords();
    setPanel(id);
  };
  const setSeasonTab = (tab: string) => {
    trackDesign(undefined, 'Panel', 'Tab', 'season', tab);
    setSeason(tab);
  };
  const setStaffTab = (tab: string) => {
    trackDesign(undefined, 'Panel', 'Tab', 'staff', tab);
    setStaff(tab);
  };
  const setAlmanacTab = (tab: string) => {
    trackDesign(undefined, 'Panel', 'Tab', 'almanac', tab);
    setAlmanac(tab);
  };
  const setMarketTab = (tab: string) => {
    trackDesign(undefined, 'Panel', 'Tab', 'market', tab);
    setMarket(tab);
  };
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
  if (seasonEnd && seasonEnd.awards.length > 0)
    news.push(t('hub.awards', { count: seasonEnd.awards.length }));
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
            {player && <EntityFlag kind="garage" id={player.garageId} />}{' '}
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
        <FeedbackLink />
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
              const entry = s.entries.find((x) => x.raceNumber === e.raceNumber);
              return (
                <li key={e.raceNumber} className="border border-lc-line bg-lc-panel p-3">
                  {entry ? (
                    <>
                      <p className="flex items-center gap-3">
                        <RaceNumber number={e.raceNumber} badge={entry.badge} size="large" />
                        <Plate plate={entry.plate} state={entry.plateState} carId={entry.carId} />
                      </p>
                      <p className="pt-1 text-sm font-medium">
                        <RegistryLink to={{ kind: 'driver', id: entry.driverId }}>
                          {e.driver}
                        </RegistryLink>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="lc-display text-3xl text-lc-accent-ink">
                        {t('shell.number', { number: e.raceNumber })}
                      </p>
                      <p className="text-sm font-medium">{e.driver}</p>
                    </>
                  )}
                  <p className="text-sm text-lc-dim">{e.car}</p>
                  {car && <ConditionBar wear={car.wear} />}
                </li>
              );
            })}
          </ul>
          <section aria-label={t('shell.news')} className="space-y-1 border-t border-lc-line pt-3">
            <h2 className="lc-display text-sm text-lc-dim">{t('shell.news')}</h2>
            <ul className="lc-news space-y-1 text-sm" aria-live="polite">
              {news.length === 0 && !hub.rounds.some((r) => r.status !== 'scheduled') && (
                <>
                  <li className="text-lc-dim">{t('shell.gettingStarted')}</li>
                  {(['sponsor', 'staff', 'drivers', 'run'] as const).map((step) => (
                    <li key={step} className="list-inside list-disc pl-2">
                      {t(`shell.start.${step}` as never)}
                    </li>
                  ))}
                </>
              )}
              {news.length === 0 && hub.rounds.some((r) => r.status !== 'scheduled') && (
                <li className="text-lc-dim">{t('shell.noNews')}</li>
              )}
              {news.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        </main>
        <nav
          aria-label={t('shell.rail')}
          className="flex w-28 flex-col border-l border-lc-line bg-lc-panel"
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
            { id: 'results', label: t('tables.results') },
            { id: 'table', label: t('hub.table') },
          ]}
          tab={seasonTab}
          onTab={setSeasonTab}
          onClose={() => setOpen(null)}
        >
          {seasonTab === 'calendar' ? (
            <SeasonCalendar />
          ) : seasonTab === 'results' ? (
            <ResultsPanel />
          ) : (
            <StandingsPanel />
          )}
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
          <div className="space-y-6">
            <OwnedCars locked={locked} />
            <EntriesSection locked={locked} />
          </div>
        </Panel>
      )}
      {!locked && open === 'market' && (
        <Panel
          title={t('rail.market')}
          tabs={[
            { id: 'market', label: t('market.heading') },
            { id: 'dealer', label: t('dealer.heading') },
            { id: 'auction', label: t('auction.heading') },
            { id: 'cars', label: t('market.cars') },
          ]}
          tab={marketTab}
          onTab={setMarketTab}
          onClose={() => setOpen(null)}
        >
          {marketTab === 'market' && <UsedMarket locked={locked} />}
          {marketTab === 'dealer' && <DealerSection locked={locked} />}
          {marketTab === 'auction' && <AuctionSection locked={locked} />}
          {marketTab === 'cars' && <OwnedCars locked={locked} />}
        </Panel>
      )}
      {!locked && open === 'upgrades' && (
        <Panel
          title={t('rail.upgrades')}
          subtitle={t('upgrades.intro')}
          onClose={() => setOpen(null)}
        >
          <UpgradesPanel />
        </Panel>
      )}
      {!locked && open === 'drivers' && (
        <Panel
          title={t('rail.drivers')}
          subtitle={t('drivers.intro')}
          onClose={() => setOpen(null)}
        >
          <DriversPanel />
        </Panel>
      )}
      {!locked && open === 'staff' && (
        <Panel
          title={t('rail.staff')}
          subtitle={t('staff.intro')}
          tabs={[
            { id: 'mechanics', label: t('staff.mechanicsTab') },
            { id: 'executives', label: t('executive.tab') },
          ]}
          tab={staffTab}
          onTab={setStaffTab}
          onClose={() => setOpen(null)}
        >
          {staffTab === 'mechanics' ? <StaffPanel /> : <ExecutivesSection />}
        </Panel>
      )}
      {!locked && open === 'almanac' && (
        <Panel
          title={t('rail.almanac')}
          subtitle={t('almanac.intro')}
          tabs={[
            { id: 'seasons', label: t('almanac.tab.seasons') },
            { id: 'records', label: t('almanac.tab.records') },
          ]}
          tab={almanacTab}
          onTab={setAlmanacTab}
          onClose={() => setOpen(null)}
        >
          <AlmanacPanel tab={almanacTab} />
        </Panel>
      )}
      {!locked && open === 'registry' && (
        <Panel title={t('rail.registry')} subtitle={t('registry.intro')} onClose={s.closeRegistry}>
          <RegistryPanel />
        </Panel>
      )}
      {!locked && open === 'operations' && (
        <Panel
          title={t('rail.operations')}
          subtitle={operationsTab === 'suppliers' ? t('supply.intro') : t('facilities.intro')}
          tabs={[
            { id: 'suppliers', label: t('operations.supplyTab') },
            { id: 'facilities', label: t('operations.facilitiesTab') },
          ]}
          tab={operationsTab}
          onTab={setOperationsTab}
          onClose={() => setOpen(null)}
        >
          {operationsTab === 'suppliers' ? <SupplyPanel /> : <FacilitiesSection />}
        </Panel>
      )}
      {!locked && open === 'sponsors' && (
        <Panel
          title={t('rail.sponsors')}
          subtitle={t('sponsors.intro')}
          onClose={() => setOpen(null)}
        >
          <SponsorsPanel />
        </Panel>
      )}
      {!locked && open === 'money' && (
        <Panel title={t('rail.money')} subtitle={t('money.intro')} onClose={() => setOpen(null)}>
          <LedgerPanel />
        </Panel>
      )}
      {open === 'menu' && (
        <Panel title={t('shell.menu')} onClose={() => setOpen(null)}>
          <div className="space-y-6">
            <MenuActions />
            <About />
          </div>
        </Panel>
      )}
    </div>
  );
}
