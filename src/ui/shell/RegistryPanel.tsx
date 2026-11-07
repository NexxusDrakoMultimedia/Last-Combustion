// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState, type ReactNode } from 'react';
import {
  formatDate,
  formatGap,
  formatLapTime,
  formatMoney,
  formatPoints,
  hasText,
  t,
} from '../../i18n';
import type { PersonKind, PersonProfile } from '../../db/people';
import type {
  CarProfile,
  DriverProfile,
  GarageProfile,
  RegistryIndex,
  ScoringSpan,
  RoundProfile,
} from '../../db/registry';
import type { ResultRow } from '../../db/tables';
import { flagNames } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { AttentionList, AttnFlag } from '../AttnFlag';
import { DecalRow, DecalStrip, StarRow } from '../Decals';
import { STATUS_ORDER, type RegistryStatus } from '../../db/status';
import { Flag } from '../Flag';
import { DragonMark, RegistryLink, YearsActive } from '../RegistryLink';
import { Plate } from '../Plate';
import { RaceNumber } from '../RaceNumber';
import { dataTable, field, quiet } from '../styles';

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

/** "2031 to 2034", or "None" for someone who has not scored. */
function scoringYears(s: ScoringSpan): string {
  return s.firstYear === null || s.lastYear === null
    ? t('registry.none')
    : t('registry.yearsRange', { first: s.firstYear, last: s.lastYear });
}

function DriverPage({ p }: { p: DriverProfile }) {
  const dragon = useCareerStore((s) => s.dragonDrivers.has(p.id));
  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        {p.number !== null && <RaceNumber number={p.number} badge={p.badge} />}
        <h2 className="lc-display text-lg">
          <Flag code={p.flag} /> {p.name}
          {dragon && (
            <>
              {' '}
              <DragonMark />
            </>
          )}
        </h2>
        {p.nickname && (
          <span className="text-lc-dim">{t('registry.nickname', { nickname: p.nickname })}</span>
        )}
        <DecalStrip decals={p.decals} />
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
          [t('registry.debut'), p.debutYear ?? t('registry.none')],
          [t('registry.fans'), p.fans.toLocaleString('en')],
        ]}
      />
      <Section title={t('registry.career')}>
        <Facts
          items={[
            [t('hub.points'), formatPoints(p.career.points)],
            [t('hub.wins'), p.career.wins],
            [t('registry.podiums'), p.career.podiums],
            [t('registry.finals'), p.career.finals],
            [t('registry.poles'), p.career.poles],
            [t('registry.championships'), p.career.championships],
            [t('registry.scoringSeasons'), p.career.scoring.seasons],
            [t('registry.scoringYears'), scoringYears(p.career.scoring)],
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
      <Section title={t('registry.attention')}>
        <AttentionList marks={p.attention} />
      </Section>
      <Section title={t('registry.seasons')}>
        {p.seasons.length === 0 ? (
          <p className="text-lc-dim">{t('registry.noSeasons')}</p>
        ) : (
          <table className={dataTable}>
            <thead className={th}>
              <tr>
                <th scope="col">{t('registry.year')}</th>
                <th scope="col">{t('registry.number')}</th>
                <th scope="col">{t('tables.garage')}</th>
                <th scope="col">{t('registry.plate')}</th>
                <th scope="col" className="text-right">
                  {t('hub.points')}
                </th>
                <th scope="col" className="text-right">
                  {t('hub.wins')}
                </th>
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
                  <td className="lc-num text-right">{formatPoints(s.points)}</td>
                  <td className="lc-num text-right">{s.wins}</td>
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
        <DecalStrip decals={p.decals} />
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
            ) : p.retiredYear !== null ? (
              t('registry.retiredYear', { year: p.retiredYear })
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
          <table className={dataTable}>
            <thead className={th}>
              <tr>
                <th scope="col">{t('registry.year')}</th>
                <th scope="col">{t('registry.number')}</th>
                <th scope="col">{t('tables.driver')}</th>
                <th scope="col">{t('tables.garage')}</th>
                <th scope="col" className="text-right">
                  {t('hub.points')}
                </th>
                <th scope="col" className="text-right">
                  {t('hub.wins')}
                </th>
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
                  <td className="lc-num text-right">{formatPoints(s.points)}</td>
                  <td className="lc-num text-right">{s.wins}</td>
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
        <h2 className="lc-display text-lg">
          <Flag code={p.flag} /> {p.name}
        </h2>
        <DecalStrip decals={p.decals} />
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
          [t('registry.scoringSeasons'), p.scoring.seasons],
          [t('registry.scoringYears'), scoringYears(p.scoring)],
        ]}
      />
      <Section title={t('registry.garageStars')}>
        <StarRow decals={p.decals} />
      </Section>
      <Section title={t('registry.attention')}>
        <AttentionList marks={p.attention} />
      </Section>
      {p.business && (
        <Section title={t('registry.business')}>
          <dl className="space-y-1">
            <div>
              <dt className="inline text-lc-dim">{t('registry.business.sponsor')} </dt>
              <dd className="inline">{p.business.sponsor ?? t('registry.none')}</dd>
            </div>
            <div>
              <dt className="inline text-lc-dim">{t('registry.business.supplier')} </dt>
              <dd className="inline">{p.business.supplier ?? t('registry.none')}</dd>
            </div>
            <div>
              <dt className="inline text-lc-dim">{t('registry.business.facilities')} </dt>
              <dd className="inline">
                {p.business.facilities.length === 0
                  ? t('registry.none')
                  : p.business.facilities
                      .map((f) =>
                        t('registry.business.facility', {
                          name: t(`facility.name.${f.kind}` as never),
                          level: f.level,
                        }),
                      )
                      .join(', ')}
              </dd>
            </div>
          </dl>
          {p.business.executives.length > 0 && (
            <ul className="mt-2 space-y-1">
              {p.business.executives.map((e) => (
                <li key={e.id}>
                  <RegistryLink to={{ kind: 'person', person: 'executive', id: e.id }}>
                    {e.name}
                  </RegistryLink>{' '}
                  <span className="text-lc-dim">{t(`executive.role.${e.role}` as never)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
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
        <table className={dataTable}>
          <thead className={th}>
            <tr>
              <th scope="col">{t('registry.year')}</th>
              <th scope="col">{t('registry.entriesCount')}</th>
              <th scope="col" className="text-right">
                {t('hub.points')}
              </th>
              <th scope="col" className="text-right">
                {t('hub.wins')}
              </th>
              <th scope="col">{t('hub.rank')}</th>
            </tr>
          </thead>
          <tbody>
            {p.seasons.map((s) => (
              <tr key={s.year} className="border-t border-lc-line">
                <td className="lc-num py-1">{s.year}</td>
                <td className="lc-num">{s.entries}</td>
                <td className="lc-num text-right">{formatPoints(s.points)}</td>
                <td className="lc-num text-right">{s.wins}</td>
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
        {r.attention && (
          <>
            {' '}
            <AttnFlag />
          </>
        )}
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
      <td className="lc-num text-right">{r.points > 0 ? formatPoints(r.points) : ''}</td>
      {race && <td className="lc-num text-right">{r.prize > 0 ? formatMoney(r.prize) : ''}</td>}
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
            <table className={dataTable}>
              <thead className={`${th} sticky top-0 bg-lc-panel`}>
                <tr>
                  <th scope="col">{t('tables.pos')}</th>
                  <th scope="col">{t('registry.number')}</th>
                  <th scope="col">{t('tables.driver')}</th>
                  <th scope="col">{t('tables.garage')}</th>
                  <th scope="col">{t('registry.plate')}</th>
                  <th scope="col">{t('tables.time')}</th>
                  <th scope="col">{t('tables.gap')}</th>
                  <th scope="col" className="text-right">
                    {t('hub.points')}
                  </th>
                  {race && (
                    <th scope="col" className="text-right">
                      {t('tables.prize')}
                    </th>
                  )}
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

/** A list split into Champions, Race winners, Active, Retired and Obscure (greylinked), empty sections left out. */
function ByStatus<T extends { status: RegistryStatus }>({
  items,
  render,
  columns = true,
}: {
  items: T[];
  render: (item: T) => ReactNode;
  columns?: boolean;
}) {
  return (
    <div className="space-y-5">
      {STATUS_ORDER.map((status) => {
        const group = items.filter((i) => i.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="space-y-2">
            <h3 className="lc-display text-xs text-lc-dim">
              {t(`registry.section.${status}` as never, { count: group.length })}
            </h3>
            {status === 'obscure' && <p className="text-lc-dim">{t('registry.obscureNote')}</p>}
            <ul className={columns ? 'grid gap-1 sm:grid-cols-2' : 'space-y-1'}>
              {group.map(render)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const INDEX_TABS = ['drivers', 'cars', 'garages', 'paddock', 'rounds'] as const;
type IndexTab = (typeof INDEX_TABS)[number];

/** Every driver, car, garage and round in its own tab, with a search that narrows the open tab. */
function IndexPage({ data }: { data: RegistryIndex }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<IndexTab>('drivers');
  const open = useCareerStore((s) => s.openRegistry);
  const q = query.trim().toLowerCase();
  const match = (...parts: (string | number | null)[]) =>
    q === '' || parts.some((x) => x !== null && String(x).toLowerCase().includes(q));
  const drivers = data.drivers.filter((d) => match(d.name, d.number, d.garage));
  const cars = data.cars.filter((c) => match(c.plate, c.model, c.plateState));
  const garages = data.garages.filter((g) => match(g.name));
  const paddock = data.people.filter((p) => match(p.name, p.garage, personRole(p.kind, p.role)));
  const rounds = data.rounds.filter((r) => match(r.year, r.course, `round ${r.round}`));
  const counts: Record<IndexTab, number> = {
    drivers: drivers.length,
    cars: cars.length,
    garages: garages.length,
    paddock: paddock.length,
    rounds: rounds.length,
  };
  return (
    <div className="space-y-4 text-sm">
      <label className="block space-y-1" htmlFor="registry-search">
        {t('registry.search')}
        <input
          id="registry-search"
          className={field}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div
        role="tablist"
        aria-label={t('registry.intro')}
        className="flex flex-wrap gap-1 border-b border-lc-line"
      >
        {INDEX_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`registry-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="registry-tab-panel"
            className={`lc-display px-3 py-2 text-xs ${
              tab === id ? 'border-b-2 border-lc-accent-ink text-lc-text' : 'text-lc-dim'
            }`}
            onClick={() => setTab(id)}
          >
            {t(`registry.${id}Count` as never, { count: counts[id] })}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="registry-tab-panel" aria-labelledby={`registry-tab-${tab}`}>
        {tab === 'drivers' && (
          <ByStatus
            items={drivers}
            render={(d) => (
              <li key={d.id} className="flex items-center gap-2">
                {d.number !== null && <RaceNumber number={d.number} badge={d.badge} />}
                <RegistryLink to={{ kind: 'driver', id: d.id }}>{d.name}</RegistryLink>
                <YearsActive kind="driver" id={d.id} />
              </li>
            )}
          />
        )}
        {tab === 'cars' && (
          <ByStatus
            items={cars}
            render={(c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Plate plate={c.plate} state={c.plateState} carId={c.id} />
                <span className="text-lc-dim">{c.model}</span>
                <YearsActive kind="car" id={c.id} />
              </li>
            )}
          />
        )}
        {tab === 'garages' && (
          <ByStatus
            items={garages}
            render={(g) => (
              <li key={g.id}>
                <RegistryLink to={{ kind: 'garage', id: g.id }}>{g.name}</RegistryLink>{' '}
                <YearsActive kind="garage" id={g.id} />
              </li>
            )}
          />
        )}
        {tab === 'paddock' && (
          <div className="space-y-6">
            {(['executive', 'staff', 'shareholder'] as const).map((kind) => {
              const group = paddock.filter((p) => p.kind === kind);
              if (group.length === 0) return null;
              return (
                <section key={kind} className="space-y-2">
                  <h3 className="lc-display text-sm text-lc-dim">
                    {t(`registry.paddock.${kind}s` as never)}
                  </h3>
                  <ByStatus
                    items={group}
                    render={(p) => (
                      <li key={`${p.kind}-${p.id}`}>
                        <RegistryLink to={{ kind: 'person', person: p.kind, id: p.id }}>
                          {p.name}
                        </RegistryLink>{' '}
                        <span className="text-lc-dim">
                          {personRole(p.kind, p.role)}
                          {p.garage ? `, ${p.garage}` : ''}
                        </span>
                      </li>
                    )}
                  />
                </section>
              );
            })}
          </div>
        )}
        {tab === 'rounds' && (
          <ul className="space-y-1">
            {rounds.map((r) => (
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
          </ul>
        )}
        {counts[tab] === 0 && <p className="text-lc-dim">{t('registry.none')}</p>}
      </div>
    </div>
  );
}

/** What a person's role is called: an executive's role, a staff member's, or a shareholder's kind of holder. */
function personRole(kind: PersonKind, role: string): string {
  const key =
    kind === 'executive'
      ? `executive.role.${role}`
      : kind === 'staff'
        ? `person.role.${role}`
        : `ownership.type.${role}`;
  return hasText(key) ? t(key as never) : role;
}

function PersonPage({ p }: { p: PersonProfile }) {
  if (p.kind === 'executive')
    return (
      <div className="space-y-5 text-sm">
        <h2 className="lc-display text-lg">{p.name}</h2>
        <Facts
          items={[
            [t('person.role'), personRole('executive', p.role)],
            [
              t('person.garage'),
              <RegistryLink key="g" to={{ kind: 'garage', id: p.garage.id }}>
                {p.garage.name}
              </RegistryLink>,
            ],
            [t('person.age'), p.age],
            [t('person.skill'), p.skill],
            [t('person.salary'), formatMoney(p.salary)],
            [
              t('person.status'),
              p.employed
                ? t('person.employed')
                : t('person.left', { date: p.leftOn ? formatDate(p.leftOn) : '' }),
            ],
            [t('person.hiredOn'), p.hiredOn ? formatDate(p.hiredOn) : t('registry.none')],
            [t('person.contractEnds'), p.contractEnds ?? t('registry.none')],
          ]}
        />
        {p.leftReason && (
          <p className="text-lc-dim">{t(`person.reason.${p.leftReason}` as never)}</p>
        )}
      </div>
    );
  if (p.kind === 'staff')
    return (
      <div className="space-y-5 text-sm">
        <h2 className="lc-display text-lg">{p.name}</h2>
        <Facts
          items={[
            [t('person.role'), personRole('staff', p.role)],
            [
              t('person.garage'),
              <RegistryLink key="g" to={{ kind: 'garage', id: p.garage.id }}>
                {p.garage.name}
              </RegistryLink>,
            ],
            [t('person.skill'), p.skill],
            [t('person.wage'), formatMoney(p.wagePerWeek)],
            [t('person.hiredOn'), formatDate(p.hiredOn)],
            [
              t('person.status'),
              p.leftOn ? t('person.left', { date: formatDate(p.leftOn) }) : t('person.employed'),
            ],
          ]}
        />
      </div>
    );
  return (
    <div className="space-y-5 text-sm">
      <h2 className="lc-display text-lg">{p.name}</h2>
      <Facts items={[[t('person.holderType'), personRole('shareholder', p.holderType)]]} />
      <Section title={t('person.holdings')}>
        {p.holdings.length === 0 ? (
          <p className="text-lc-dim">{t('person.noHoldings')}</p>
        ) : (
          <table className={dataTable}>
            <thead>
              <tr>
                <th scope="col">{t('person.garage')}</th>
                <th scope="col">{t('person.class')}</th>
                <th scope="col" className="text-right">
                  {t('person.shares')}
                </th>
                <th scope="col" className="text-right">
                  {t('person.stake')}
                </th>
                <th scope="col" className="text-right">
                  {t('person.paid')}
                </th>
                <th scope="col" className="text-right">
                  {t('person.worth')}
                </th>
                <th scope="col">{t('person.since')}</th>
              </tr>
            </thead>
            <tbody>
              {p.holdings.map((h) => (
                <tr key={`${h.garage.id}-${h.class}-${h.since}`}>
                  <td>
                    <RegistryLink to={{ kind: 'garage', id: h.garage.id }}>
                      {h.garage.name}
                    </RegistryLink>
                  </td>
                  <td>{t(`ownership.class.${h.class}` as never)}</td>
                  <td className="lc-num text-right">{h.shares.toLocaleString('en-AU')}</td>
                  <td className="lc-num text-right">{`${Math.round(h.stake * 1000) / 10}%`}</td>
                  <td className="lc-num text-right">{formatMoney(h.paid)}</td>
                  <td className="lc-num text-right">{formatMoney(h.worth)}</td>
                  <td className="lc-num">{formatDate(h.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
      {registryPage.kind === 'person' && <PersonPage p={registryPage.data} />}
      {(registryPage.kind === 'prelim' || registryPage.kind === 'race') && (
        <RoundPage p={registryPage.data} />
      )}
    </div>
  );
}
