// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState, type ReactNode } from 'react';
import { formatDate, formatGap, formatLapTime, formatMoney, t } from '../../i18n';
import type {
  CarProfile,
  DriverProfile,
  GarageProfile,
  LedgerIndex,
  RoundProfile,
} from '../../db/ledger';
import type { ResultRow } from '../../db/tables';
import { flagNames } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { DecalRow } from '../Decals';
import { LedgerLink } from '../LedgerLink';
import { Plate } from '../Plate';
import { RaceNumber } from '../RaceNumber';
import { field, quiet } from '../styles';

const flagName = (code: string): string => flagNames[code]?.short ?? code;
const place = (rank: number | null): string => (rank === null ? t('ledger.none') : String(rank));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="lc-display text-sm text-lc-dim">{title}</h3>
      {children}
    </section>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border border-lc-line bg-lc-raised p-3 sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="lc-display text-xs text-lc-dim">{label}</dt>
          <dd className="lc-num">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const th = 'lc-display text-xs text-lc-dim';

function DriverPage({ p }: { p: DriverProfile }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {p.number !== null && <RaceNumber number={p.number} badge={p.badge} />}
        <h2 className="lc-display text-lg">{p.name}</h2>
        {p.nickname && (
          <span className="text-lc-dim">{t('ledger.nickname', { nickname: p.nickname })}</span>
        )}
      </div>
      <Facts
        items={[
          [t('ledger.age'), p.age],
          [t('ledger.nation'), flagName(p.flag)],
          [t('ledger.identity'), t(`identity.${p.identity}` as never)],
          [t('ledger.hometown'), p.hometown],
          [t('ledger.residence'), p.residence],
          [t('ledger.preferredNumber'), p.preferredNumber ?? t('ledger.none')],
          [
            t('ledger.border'),
            p.goldBorderYear !== null
              ? t('ledger.goldSince', { year: p.goldBorderYear })
              : p.silverBorderYear !== null
                ? t('ledger.silverSince', { year: p.silverBorderYear })
                : t('ledger.noBorder'),
          ],
          [
            t('ledger.status'),
            p.retiredYear !== null
              ? t('ledger.retired', { year: p.retiredYear })
              : t('ledger.active'),
          ],
          [t('ledger.fans'), p.fans.toLocaleString('en')],
        ]}
      />
      <Section title={t('ledger.career')}>
        <Facts
          items={[
            [t('hub.points'), p.career.points],
            [t('hub.wins'), p.career.wins],
            [t('ledger.podiums'), p.career.podiums],
            [t('ledger.finals'), p.career.finals],
            [t('ledger.poles'), p.career.poles],
            [t('ledger.championships'), p.career.championships],
          ]}
        />
      </Section>
      <Section title={t('ledger.skills')}>
        <Facts
          items={(
            [
              'pace',
              'consistency',
              'racecraft',
              'tyreManagement',
              'composure',
              'wetSkill',
              'potential',
            ] as const
          ).map((k) => [t(`ledger.stat.${k}` as never), p.stats[k]] as [string, ReactNode])}
        />
      </Section>
      <Section title={t('ledger.driverDecals')}>
        <DecalRow decals={p.decals} />
        {p.titles.length > 0 && (
          <p className="text-lc-dim">
            {p.titles.map((x) => t('ledger.titleLine', { name: x.name, year: x.year })).join(', ')}
          </p>
        )}
      </Section>
      <Section title={t('ledger.seasons')}>
        {p.seasons.length === 0 ? (
          <p className="text-lc-dim">{t('ledger.noSeasons')}</p>
        ) : (
          <table className="w-full text-left">
            <thead className={th}>
              <tr>
                <th scope="col">{t('ledger.year')}</th>
                <th scope="col">{t('ledger.number')}</th>
                <th scope="col">{t('tables.garage')}</th>
                <th scope="col">{t('ledger.plate')}</th>
                <th scope="col">{t('hub.points')}</th>
                <th scope="col">{t('hub.wins')}</th>
                <th scope="col">{t('hub.rank')}</th>
              </tr>
            </thead>
            <tbody>
              {p.seasons.map((s) => (
                <tr key={s.year} className="border-t border-lc-line">
                  <td className="lc-num py-1">{s.year}</td>
                  <td>
                    <RaceNumber number={s.number} badge={s.badge} />
                  </td>
                  <td>
                    <LedgerLink to={{ kind: 'garage', id: s.garage.id }}>
                      {s.garage.name}
                    </LedgerLink>
                  </td>
                  <td>
                    <Plate plate={s.car.plate} state={s.car.plateState} carId={s.car.id} />
                  </td>
                  <td className="lc-num">{s.points}</td>
                  <td className="lc-num">{s.wins}</td>
                  <td className="lc-num">{place(s.rank)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section title={t('ledger.contracts')}>
        <ul className="space-y-1">
          {p.contracts.map((c, i) => (
            <li key={`${c.garage.id}-${c.startYear}-${i}`}>
              <LedgerLink to={{ kind: 'garage', id: c.garage.id }}>{c.garage.name}</LedgerLink>{' '}
              <span className="lc-num text-lc-dim">
                {t('ledger.contractLine', {
                  start: c.startYear,
                  end: c.endYear,
                  salary: formatMoney(c.salary),
                })}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function CarPage({ p }: { p: CarProfile }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Plate plate={p.plate} state={p.plateState} />
        <h2 className="lc-display text-lg">
          {t('ledger.carTitle', { year: p.modelYear, make: p.manufacturer, model: p.model })}
        </h2>
      </div>
      <Facts
        items={[
          [t('ledger.chassis'), p.chassisNo],
          [t('ledger.tier'), p.tier],
          [t('ledger.nation'), flagName(p.flag)],
          [
            t('ledger.ownedBy'),
            p.garage ? (
              <LedgerLink to={{ kind: 'garage', id: p.garage.id }}>{p.garage.name}</LedgerLink>
            ) : (
              t('ledger.forSale')
            ),
          ],
          [t('ledger.roadKm'), p.roadKm.toLocaleString('en')],
          [t('ledger.raceKm'), p.raceKm.toLocaleString('en')],
          [t('ledger.wear'), p.wear],
          [t('ledger.weight'), t('ledger.weightValue', { kg: p.kerbKg, mm: p.tyreWidthMm })],
          [t('ledger.fans'), p.fans.toLocaleString('en')],
        ]}
      />
      <Section title={t('ledger.carDecals')}>
        <DecalRow decals={p.decals} />
      </Section>
      <Section title={t('ledger.drivers')}>
        {p.seasons.length === 0 ? (
          <p className="text-lc-dim">{t('ledger.noSeasons')}</p>
        ) : (
          <table className="w-full text-left">
            <thead className={th}>
              <tr>
                <th scope="col">{t('ledger.year')}</th>
                <th scope="col">{t('ledger.number')}</th>
                <th scope="col">{t('tables.driver')}</th>
                <th scope="col">{t('tables.garage')}</th>
                <th scope="col">{t('hub.points')}</th>
                <th scope="col">{t('hub.wins')}</th>
              </tr>
            </thead>
            <tbody>
              {p.seasons.map((s) => (
                <tr key={`${s.year}-${s.number}`} className="border-t border-lc-line">
                  <td className="lc-num py-1">{s.year}</td>
                  <td>
                    <RaceNumber number={s.number} badge={s.badge} />
                  </td>
                  <td>
                    <LedgerLink to={{ kind: 'driver', id: s.driver.id }}>
                      {s.driver.name}
                    </LedgerLink>
                  </td>
                  <td>
                    <LedgerLink to={{ kind: 'garage', id: s.garage.id }}>
                      {s.garage.name}
                    </LedgerLink>
                  </td>
                  <td className="lc-num">{s.points}</td>
                  <td className="lc-num">{s.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section title={t('ledger.owners')}>
        <ul className="space-y-1">
          {p.owners.map((o, i) => (
            <li key={`${o.garage.id}-${o.from}-${i}`}>
              {o.forSale ? (
                t('ledger.forSale')
              ) : (
                <LedgerLink to={{ kind: 'garage', id: o.garage.id }}>{o.garage.name}</LedgerLink>
              )}{' '}
              <span className="lc-num text-lc-dim">
                {t('ledger.ownerLine', {
                  from: formatDate(o.from),
                  to: o.to ? formatDate(o.to) : t('ledger.present'),
                  price: formatMoney(o.price),
                  route: t(`ledger.route.${o.route}` as never),
                })}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('ledger.parts')}>
        {p.parts.length === 0 ? (
          <p className="text-lc-dim">{t('ledger.noParts')}</p>
        ) : (
          <ul className="space-y-1">
            {p.parts.map((x) => (
              <li key={x.category}>
                <span className="text-lc-dim">{x.category}</span> {x.name}{' '}
                <span className="text-lc-dim">
                  {t('ledger.partLine', { supplier: x.supplier, grade: x.grade })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function GaragePage({ p }: { p: GarageProfile }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-block h-5 w-8 rounded-sm border border-lc-line"
          style={{ background: `linear-gradient(90deg, ${p.colours[0]} 50%, ${p.colours[1]} 50%)` }}
        />
        <h2 className="lc-display text-lg">{p.name}</h2>
      </div>
      <Facts
        items={[
          [t('ledger.nation'), flagName(p.flag)],
          [t('ledger.base'), p.base],
          [t('ledger.founded'), p.foundedYear],
          [t('ledger.prestige'), p.prestige],
          [t('ledger.fans'), p.fans.toLocaleString('en')],
          [
            t('ledger.status'),
            p.closedYear !== null ? t('ledger.closed', { year: p.closedYear }) : t('ledger.active'),
          ],
          ...(p.cash !== null
            ? ([[t('money.cash'), formatMoney(p.cash)]] as [string, ReactNode][])
            : []),
          [
            t('ledger.championships'),
            p.championships.length > 0 ? p.championships.join(', ') : t('ledger.none'),
          ],
        ]}
      />
      <Section title={t('ledger.entries')}>
        {p.entries.length === 0 ? (
          <p className="text-lc-dim">{t('ledger.noEntries')}</p>
        ) : (
          <ul className="space-y-1">
            {p.entries.map((e) => (
              <li key={e.number} className="flex flex-wrap items-center gap-2">
                <RaceNumber number={e.number} badge={e.badge} />
                <LedgerLink to={{ kind: 'driver', id: e.driver.id }}>{e.driver.name}</LedgerLink>
                <Plate plate={e.car.plate} state={e.car.plateState} carId={e.car.id} />
                <span className="text-lc-dim">{e.car.model}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('ledger.seasons')}>
        <table className="w-full text-left">
          <thead className={th}>
            <tr>
              <th scope="col">{t('ledger.year')}</th>
              <th scope="col">{t('ledger.entriesCount')}</th>
              <th scope="col">{t('hub.points')}</th>
              <th scope="col">{t('hub.wins')}</th>
              <th scope="col">{t('hub.rank')}</th>
            </tr>
          </thead>
          <tbody>
            {p.seasons.map((s) => (
              <tr key={s.year} className="border-t border-lc-line">
                <td className="lc-num py-1">{s.year}</td>
                <td className="lc-num">{s.entries}</td>
                <td className="lc-num">{s.points}</td>
                <td className="lc-num">{s.wins}</td>
                <td className="lc-num">{place(s.rank)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title={t('ledger.cars')}>
        <ul className="flex flex-wrap gap-3">
          {p.cars.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <Plate plate={c.plate} state={c.plateState} carId={c.id} />
              <span className="text-lc-dim">{c.model}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('ledger.drivers')}>
        <ul className="space-y-1">
          {p.drivers.map((d) => (
            <li key={d.id}>
              <LedgerLink to={{ kind: 'driver', id: d.id }}>{d.name}</LedgerLink>{' '}
              <span className="lc-num text-lc-dim">{d.years}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function ClassificationRow({ r, race }: { r: ResultRow; race: boolean }) {
  return (
    <tr className={`border-t border-lc-line ${r.mine ? 'bg-lc-raised font-medium' : ''}`}>
      <td className="lc-num py-1">{r.position ?? t('tables.none')}</td>
      <td>
        <RaceNumber number={r.raceNumber} badge={r.badge} />
      </td>
      <td>
        <LedgerLink to={{ kind: 'driver', id: r.driverId }}>{r.driver}</LedgerLink>
        {r.pole && !race && ` ${t('tables.pole')}`}
      </td>
      <td className="text-lc-dim">
        <LedgerLink to={{ kind: 'garage', id: r.garageId }}>{r.garage}</LedgerLink>
      </td>
      <td>
        <Plate plate={r.plate} state={r.plateState} carId={r.carId} />
      </td>
      <td className="lc-num">
        {r.timeMs === null
          ? r.dnf
            ? t('tables.dnf', { reason: r.dnf })
            : ''
          : formatLapTime(r.timeMs)}
      </td>
      <td className="lc-num">{r.gapMs !== null && r.gapMs > 0 ? formatGap(r.gapMs) : ''}</td>
      <td className="lc-num">{r.points > 0 ? r.points : ''}</td>
      {race && <td className="lc-num">{r.prize > 0 ? formatMoney(r.prize) : ''}</td>}
    </tr>
  );
}

function RoundPage({ p }: { p: RoundProfile }) {
  const race = p.kind === 'race';
  const other = race ? 'prelim' : 'race';
  return (
    <div className="space-y-5 text-sm">
      <h2 className="lc-display text-lg">
        {t(race ? 'ledger.raceTitle' : 'ledger.prelimTitle', {
          year: p.year,
          round: p.round,
          course: p.course,
        })}
      </h2>
      <p>
        <LedgerLink to={{ kind: other, year: p.year, round: p.round }}>
          {t(race ? 'ledger.seePrelims' : 'ledger.seeRace')}
        </LedgerLink>
      </p>
      <Facts
        items={[
          [t('ledger.practiceFrom'), formatDate(p.practiceStart)],
          [t('ledger.prelimsFrom'), formatDate(p.prelimStart)],
          [t('ledger.finalOn'), formatDate(p.finalDate)],
          [
            t('ledger.pole'),
            p.pole ? (
              <LedgerLink to={{ kind: 'driver', id: p.pole.id }}>{p.pole.name}</LedgerLink>
            ) : (
              t('ledger.none')
            ),
          ],
          [
            t('ledger.winner'),
            p.winner ? (
              <LedgerLink to={{ kind: 'driver', id: p.winner.id }}>{p.winner.name}</LedgerLink>
            ) : (
              t('ledger.none')
            ),
          ],
        ]}
      />
      {p.days.length > 0 && (
        <Section title={t('ledger.conditions')}>
          <ul className="flex flex-wrap gap-2">
            {p.days.map((d) => (
              <li key={d.date} className="border border-lc-line p-2">
                <span className="lc-num block">{formatDate(d.date)}</span>
                <span className="text-lc-dim">
                  {t('ledger.dayLine', {
                    kind: t(`ledger.day.${d.kind}` as never),
                    weather: t(`ledger.weather.${d.weather}` as never),
                    temp: Math.round(d.temperatureC),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={t(race ? 'tables.session.final' : 'tables.session.prelims')}>
        {p.rows.length === 0 ? (
          <p className="text-lc-dim">{t('tables.notRun')}</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full text-left">
              <thead className={`${th} sticky top-0 bg-lc-panel`}>
                <tr>
                  <th scope="col">{t('tables.pos')}</th>
                  <th scope="col">{t('ledger.number')}</th>
                  <th scope="col">{t('tables.driver')}</th>
                  <th scope="col">{t('tables.garage')}</th>
                  <th scope="col">{t('ledger.plate')}</th>
                  <th scope="col">{t('tables.time')}</th>
                  <th scope="col">{t('tables.gap')}</th>
                  <th scope="col">{t('hub.points')}</th>
                  {race && <th scope="col">{t('tables.prize')}</th>}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r) => (
                  <ClassificationRow key={r.raceNumber} r={r} race={race} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

const MAX_SHOWN = 40;

function IndexPage({ data }: { data: LedgerIndex }) {
  const [query, setQuery] = useState('');
  const open = useCareerStore((s) => s.openLedger);
  const q = query.trim().toLowerCase();
  const match = (...parts: (string | number | null)[]) =>
    q === '' || parts.some((x) => x !== null && String(x).toLowerCase().includes(q));
  const drivers = data.drivers.filter((d) => match(d.name, d.number, d.garage));
  const cars = data.cars.filter((c) => match(c.plate, c.model, c.plateState));
  const garages = data.garages.filter((g) => match(g.name));
  const rounds = data.rounds.filter((r) => match(r.year, r.course, `round ${r.round}`));
  const more = (n: number) =>
    n > MAX_SHOWN ? (
      <li className="text-lc-dim">{t('ledger.more', { count: n - MAX_SHOWN })}</li>
    ) : null;
  return (
    <div className="space-y-5 text-sm">
      <label className="block space-y-1" htmlFor="ledger-search">
        {t('ledger.search')}
        <input
          id="ledger-search"
          className={field}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <Section title={t('ledger.driversCount', { count: drivers.length })}>
        <ul className="grid gap-1 sm:grid-cols-2">
          {drivers.slice(0, MAX_SHOWN).map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              {d.number !== null && <RaceNumber number={d.number} badge={d.badge} />}
              <LedgerLink to={{ kind: 'driver', id: d.id }}>{d.name}</LedgerLink>
              {d.garage && <span className="text-lc-dim">{d.garage}</span>}
            </li>
          ))}
          {more(drivers.length)}
        </ul>
      </Section>
      <Section title={t('ledger.carsCount', { count: cars.length })}>
        <ul className="grid gap-1 sm:grid-cols-2">
          {cars.slice(0, MAX_SHOWN).map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <Plate plate={c.plate} state={c.plateState} carId={c.id} />
              <span className="text-lc-dim">{c.model}</span>
            </li>
          ))}
          {more(cars.length)}
        </ul>
      </Section>
      <Section title={t('ledger.garagesCount', { count: garages.length })}>
        <ul className="grid gap-1 sm:grid-cols-2">
          {garages.slice(0, MAX_SHOWN).map((g) => (
            <li key={g.id}>
              <LedgerLink to={{ kind: 'garage', id: g.id }}>{g.name}</LedgerLink>
            </li>
          ))}
          {more(garages.length)}
        </ul>
      </Section>
      <Section title={t('ledger.roundsCount', { count: rounds.length })}>
        <ul className="space-y-1">
          {rounds.slice(0, MAX_SHOWN).map((r) => (
            <li key={`${r.year}-${r.round}`} className="flex flex-wrap items-center gap-3">
              <span className="lc-num">
                {t('ledger.roundName', { year: r.year, round: r.round, course: r.course })}
              </span>
              <button
                type="button"
                className={quiet}
                onClick={() => open({ kind: 'prelim', year: r.year, round: r.round })}
              >
                {t('tables.session.prelims')}
              </button>
              <button
                type="button"
                className={quiet}
                onClick={() => open({ kind: 'race', year: r.year, round: r.round })}
              >
                {t('ledger.race')}
              </button>
            </li>
          ))}
          {more(rounds.length)}
        </ul>
      </Section>
    </div>
  );
}

/** The Ledger: a profile of every driver, car, garage, round's prelims and race, with links between them. */
export function LedgerPanel() {
  const { ledgerPage, ledgerTrail, ledgerBack, openLedger } = useCareerStore();
  if (!ledgerPage) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={quiet}
          disabled={ledgerTrail.length < 2}
          onClick={ledgerBack}
        >
          {t('ledger.back')}
        </button>
        <button type="button" className={quiet} onClick={() => openLedger({ kind: 'index' })}>
          {t('ledger.index')}
        </button>
      </div>
      {ledgerPage.kind === 'index' && <IndexPage data={ledgerPage.data} />}
      {ledgerPage.kind === 'driver' && <DriverPage p={ledgerPage.data} />}
      {ledgerPage.kind === 'car' && <CarPage p={ledgerPage.data} />}
      {ledgerPage.kind === 'garage' && <GaragePage p={ledgerPage.data} />}
      {(ledgerPage.kind === 'prelim' || ledgerPage.kind === 'race') && (
        <RoundPage p={ledgerPage.data} />
      )}
    </div>
  );
}
