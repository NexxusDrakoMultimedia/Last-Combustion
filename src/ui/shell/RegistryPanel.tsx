// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState, type ReactNode } from 'react';
import { formatDate, formatGap, formatLapTime, formatMoney, t } from '../../i18n';
import type {
  CarProfile,
  DriverProfile,
  GarageProfile,
  RegistryIndex,
  RoundProfile,
} from '../../db/registry';
import type { ResultRow } from '../../db/tables';
import { flagNames } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { DecalRow } from '../Decals';
import { RegistryLink } from '../RegistryLink';
import { Plate } from '../Plate';
import { RaceNumber } from '../RaceNumber';
import { field, quiet } from '../styles';

const flagName = (code: string): string => flagNames[code]?.short ?? code;
const place = (rank: number | null): string => (rank === null ? t('registry.none') : String(rank));

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
          <span className="text-lc-dim">{t('registry.nickname', { nickname: p.nickname })}</span>
        )}
      </div>
      <Facts
        items={[
          [t('registry.age'), p.age],
          [t('registry.nation'), flagName(p.flag)],
          [t('registry.identity'), t(`identity.${p.identity}` as never)],
          [t('registry.hometown'), p.hometown],
          [t('registry.residence'), p.residence],
          [t('registry.preferredNumber'), p.preferredNumber ?? t('registry.none')],
          [
            t('registry.border'),
            p.goldBorderYear !== null
              ? t('registry.goldSince', { year: p.goldBorderYear })
              : p.silverBorderYear !== null
                ? t('registry.silverSince', { year: p.silverBorderYear })
                : t('registry.noBorder'),
          ],
          [
            t('registry.status'),
            p.retiredYear !== null
              ? t('registry.retired', { year: p.retiredYear })
              : t('registry.active'),
          ],
          [t('registry.fans'), p.fans.toLocaleString('en')],
        ]}
      />
      <Section title={t('registry.career')}>
        <Facts
          items={[
            [t('hub.points'), p.career.points],
            [t('hub.wins'), p.career.wins],
            [t('registry.podiums'), p.career.podiums],
            [t('registry.finals'), p.career.finals],
            [t('registry.poles'), p.career.poles],
            [t('registry.championships'), p.career.championships],
          ]}
        />
      </Section>
      <Section title={t('registry.skills')}>
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
          ).map((k) => [t(`registry.stat.${k}` as never), p.stats[k]] as [string, ReactNode])}
        />
      </Section>
      <Section title={t('registry.driverDecals')}>
        <DecalRow decals={p.decals} />
        {p.titles.length > 0 && (
          <p className="text-lc-dim">
            {p.titles
              .map((x) => t('registry.titleLine', { name: x.name, year: x.year }))
              .join(', ')}
          </p>
        )}
      </Section>
      <Section title={t('registry.seasons')}>
        {p.seasons.length === 0 ? (
          <p className="text-lc-dim">{t('registry.noSeasons')}</p>
        ) : (
          <table className="w-full text-left">
            <thead className={th}>
              <tr>
                <th scope="col">{t('registry.year')}</th>
                <th scope="col">{t('registry.number')}</th>
                <th scope="col">{t('tables.garage')}</th>
                <th scope="col">{t('registry.plate')}</th>
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
                    <RegistryLink to={{ kind: 'garage', id: s.garage.id }}>
                      {s.garage.name}
                    </RegistryLink>
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
      <Section title={t('registry.contracts')}>
        <ul className="space-y-1">
          {p.contracts.map((c, i) => (
            <li key={`${c.garage.id}-${c.startYear}-${i}`}>
              <RegistryLink to={{ kind: 'garage', id: c.garage.id }}>{c.garage.name}</RegistryLink>{' '}
              <span className="lc-num text-lc-dim">
                {t('registry.contractLine', {
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
          {t('registry.carTitle', { year: p.modelYear, make: p.manufacturer, model: p.model })}
        </h2>
      </div>
      <Facts
        items={[
          [t('registry.chassis'), p.chassisNo],
          [t('registry.tier'), p.tier],
          [t('registry.nation'), flagName(p.flag)],
          [
            t('registry.ownedBy'),
            p.garage ? (
              <RegistryLink to={{ kind: 'garage', id: p.garage.id }}>{p.garage.name}</RegistryLink>
            ) : (
              t('registry.forSale')
            ),
          ],
          [t('registry.roadKm'), p.roadKm.toLocaleString('en')],
          [t('registry.raceKm'), p.raceKm.toLocaleString('en')],
          [t('registry.wear'), p.wear],
          [
            t('registry.restorations'),
            p.restorations === 0
              ? t('registry.none')
              : t('registry.restorationsValue', { count: p.restorations, floor: p.wearFloor }),
          ],
          [t('registry.weight'), t('registry.weightValue', { kg: p.kerbKg, mm: p.tyreWidthMm })],
          [t('registry.fans'), p.fans.toLocaleString('en')],
        ]}
      />
      <Section title={t('registry.carDecals')}>
        <DecalRow decals={p.decals} />
      </Section>
      <Section title={t('registry.drivers')}>
        {p.seasons.length === 0 ? (
          <p className="text-lc-dim">{t('registry.noSeasons')}</p>
        ) : (
          <table className="w-full text-left">
            <thead className={th}>
              <tr>
                <th scope="col">{t('registry.year')}</th>
                <th scope="col">{t('registry.number')}</th>
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
                    <RegistryLink to={{ kind: 'driver', id: s.driver.id }}>
                      {s.driver.name}
                    </RegistryLink>
                  </td>
                  <td>
                    <RegistryLink to={{ kind: 'garage', id: s.garage.id }}>
                      {s.garage.name}
                    </RegistryLink>
                  </td>
                  <td className="lc-num">{s.points}</td>
                  <td className="lc-num">{s.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      <Section title={t('registry.owners')}>
        <ul className="space-y-1">
          {p.owners.map((o, i) => (
            <li key={`${o.garage.id}-${o.from}-${i}`}>
              {o.forSale ? (
                t('registry.forSale')
              ) : (
                <RegistryLink to={{ kind: 'garage', id: o.garage.id }}>
                  {o.garage.name}
                </RegistryLink>
              )}{' '}
              <span className="lc-num text-lc-dim">
                {t('registry.ownerLine', {
                  from: formatDate(o.from),
                  to: o.to ? formatDate(o.to) : t('registry.present'),
                  price: formatMoney(o.price),
                  route: t(`registry.route.${o.route}` as never),
                })}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('registry.parts')}>
        {p.parts.length === 0 ? (
          <p className="text-lc-dim">{t('registry.noParts')}</p>
        ) : (
          <ul className="space-y-1">
            {p.parts.map((x) => (
              <li key={x.category}>
                <span className="text-lc-dim">{x.category}</span> {x.name}{' '}
                <span className="text-lc-dim">
                  {t('registry.partLine', { supplier: x.supplier, grade: x.grade })}
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
          [t('registry.nation'), flagName(p.flag)],
          [t('registry.base'), p.base],
          [t('registry.headquarters'), p.headquarters],
          [t('registry.founded'), p.foundedYear],
          [t('registry.prestige'), p.prestige],
          [t('registry.fans'), p.fans.toLocaleString('en')],
          [
            t('registry.status'),
            p.closedYear !== null
              ? t('registry.closed', { year: p.closedYear })
              : t('registry.active'),
          ],
          ...(p.cash !== null
            ? ([[t('money.cash'), formatMoney(p.cash)]] as [string, ReactNode][])
            : []),
          [
            t('registry.championships'),
            p.championships.length > 0 ? p.championships.join(', ') : t('registry.none'),
          ],
        ]}
      />
      <Section title={t('registry.entries')}>
        {p.entries.length === 0 ? (
          <p className="text-lc-dim">{t('registry.noEntries')}</p>
        ) : (
          <ul className="space-y-1">
            {p.entries.map((e) => (
              <li key={e.number} className="flex flex-wrap items-center gap-2">
                <RaceNumber number={e.number} badge={e.badge} />
                <RegistryLink to={{ kind: 'driver', id: e.driver.id }}>
                  {e.driver.name}
                </RegistryLink>
                <Plate plate={e.car.plate} state={e.car.plateState} carId={e.car.id} />
                <span className="text-lc-dim">{e.car.model}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t('registry.seasons')}>
        <table className="w-full text-left">
          <thead className={th}>
            <tr>
              <th scope="col">{t('registry.year')}</th>
              <th scope="col">{t('registry.entriesCount')}</th>
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
      <Section title={t('registry.cars')}>
        <ul className="flex flex-wrap gap-3">
          {p.cars.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <Plate plate={c.plate} state={c.plateState} carId={c.id} />
              <span className="text-lc-dim">{c.model}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={t('registry.drivers')}>
        <ul className="space-y-1">
          {p.drivers.map((d) => (
            <li key={d.id}>
              <RegistryLink to={{ kind: 'driver', id: d.id }}>{d.name}</RegistryLink>{' '}
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
        <RegistryLink to={{ kind: 'driver', id: r.driverId }}>{r.driver}</RegistryLink>
        {r.pole && !race && ` ${t('tables.pole')}`}
      </td>
      <td className="text-lc-dim">
        <RegistryLink to={{ kind: 'garage', id: r.garageId }}>{r.garage}</RegistryLink>
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
        {t(race ? 'registry.raceTitle' : 'registry.prelimTitle', {
          year: p.year,
          round: p.round,
          course: p.course,
        })}
      </h2>
      <p>
        <RegistryLink to={{ kind: other, year: p.year, round: p.round }}>
          {t(race ? 'registry.seePrelims' : 'registry.seeRace')}
        </RegistryLink>
      </p>
      <Facts
        items={[
          [t('registry.practiceFrom'), formatDate(p.practiceStart)],
          [t('registry.prelimsFrom'), formatDate(p.prelimStart)],
          [t('registry.finalOn'), formatDate(p.finalDate)],
          [
            t('registry.pole'),
            p.pole ? (
              <RegistryLink to={{ kind: 'driver', id: p.pole.id }}>{p.pole.name}</RegistryLink>
            ) : (
              t('registry.none')
            ),
          ],
          [
            t('registry.winner'),
            p.winner ? (
              <RegistryLink to={{ kind: 'driver', id: p.winner.id }}>{p.winner.name}</RegistryLink>
            ) : (
              t('registry.none')
            ),
          ],
        ]}
      />
      {p.days.length > 0 && (
        <Section title={t('registry.conditions')}>
          <ul className="flex flex-wrap gap-2">
            {p.days.map((d) => (
              <li key={d.date} className="border border-lc-line p-2">
                <span className="lc-num block">{formatDate(d.date)}</span>
                <span className="text-lc-dim">
                  {t('registry.dayLine', {
                    kind: t(`registry.day.${d.kind}` as never),
                    weather: t(`registry.weather.${d.weather}` as never),
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
                  <th scope="col">{t('registry.number')}</th>
                  <th scope="col">{t('tables.driver')}</th>
                  <th scope="col">{t('tables.garage')}</th>
                  <th scope="col">{t('registry.plate')}</th>
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

function IndexPage({ data }: { data: RegistryIndex }) {
  const [query, setQuery] = useState('');
  const open = useCareerStore((s) => s.openRegistry);
  const q = query.trim().toLowerCase();
  const match = (...parts: (string | number | null)[]) =>
    q === '' || parts.some((x) => x !== null && String(x).toLowerCase().includes(q));
  const drivers = data.drivers.filter((d) => match(d.name, d.number, d.garage));
  const cars = data.cars.filter((c) => match(c.plate, c.model, c.plateState));
  const garages = data.garages.filter((g) => match(g.name));
  const rounds = data.rounds.filter((r) => match(r.year, r.course, `round ${r.round}`));
  const more = (n: number) =>
    n > MAX_SHOWN ? (
      <li className="text-lc-dim">{t('registry.more', { count: n - MAX_SHOWN })}</li>
    ) : null;
  return (
    <div className="space-y-5 text-sm">
      <label className="block space-y-1" htmlFor="registry-search">
        {t('registry.search')}
        <input
          id="registry-search"
          className={field}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <Section title={t('registry.driversCount', { count: drivers.length })}>
        <ul className="grid gap-1 sm:grid-cols-2">
          {drivers.slice(0, MAX_SHOWN).map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              {d.number !== null && <RaceNumber number={d.number} badge={d.badge} />}
              <RegistryLink to={{ kind: 'driver', id: d.id }}>{d.name}</RegistryLink>
              {d.garage && <span className="text-lc-dim">{d.garage}</span>}
            </li>
          ))}
          {more(drivers.length)}
        </ul>
      </Section>
      <Section title={t('registry.carsCount', { count: cars.length })}>
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
      <Section title={t('registry.garagesCount', { count: garages.length })}>
        <ul className="grid gap-1 sm:grid-cols-2">
          {garages.slice(0, MAX_SHOWN).map((g) => (
            <li key={g.id}>
              <RegistryLink to={{ kind: 'garage', id: g.id }}>{g.name}</RegistryLink>
            </li>
          ))}
          {more(garages.length)}
        </ul>
      </Section>
      <Section title={t('registry.roundsCount', { count: rounds.length })}>
        <ul className="space-y-1">
          {rounds.slice(0, MAX_SHOWN).map((r) => (
            <li key={`${r.year}-${r.round}`} className="flex flex-wrap items-center gap-3">
              <span className="lc-num">
                {t('registry.roundName', { year: r.year, round: r.round, course: r.course })}
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
                {t('registry.race')}
              </button>
            </li>
          ))}
          {more(rounds.length)}
        </ul>
      </Section>
    </div>
  );
}

/** The Registry: a profile of every driver, car, garage, round's prelims and race, with links between them. */
export function RegistryPanel() {
  const { registryPage, registryTrail, registryBack, openRegistry } = useCareerStore();
  if (!registryPage) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={quiet}
          disabled={registryTrail.length < 2}
          onClick={registryBack}
        >
          {t('registry.back')}
        </button>
        <button type="button" className={quiet} onClick={() => openRegistry({ kind: 'index' })}>
          {t('registry.index')}
        </button>
      </div>
      {registryPage.kind === 'index' && <IndexPage data={registryPage.data} />}
      {registryPage.kind === 'driver' && <DriverPage p={registryPage.data} />}
      {registryPage.kind === 'car' && <CarPage p={registryPage.data} />}
      {registryPage.kind === 'garage' && <GaragePage p={registryPage.data} />}
      {(registryPage.kind === 'prelim' || registryPage.kind === 'race') && (
        <RoundPage p={registryPage.data} />
      )}
    </div>
  );
}
