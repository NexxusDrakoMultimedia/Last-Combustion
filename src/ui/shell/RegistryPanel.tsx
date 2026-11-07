// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { moraleText } from '../moraleText';
import { useState, type ReactNode } from 'react';
import { formatDate, formatMoney, formatPoints, hasText, t } from '../../i18n';
import type { HoldingLine, PersonKind, PersonProfile, PersonRef } from '../../db/people';
import type { Origin, PlaceLine } from '../../db/origins';
import type {
  CarProfile,
  DriverProfile,
  GarageProfile,
  RegistryIndex,
  ScoringSpan,
} from '../../db/registry';
import { flagNames } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { AttentionList } from '../AttnFlag';
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
            p.died
              ? t('registry.died', {
                  date: formatDate(p.died.date),
                  cause: t(`death.cause.${p.died.cause}` as never),
                })
              : p.retiredYear !== null
                ? t('registry.retired', { year: p.retiredYear })
                : t('registry.active'),
          ],
          [t('registry.debut'), p.debutYear ?? t('registry.none')],
          [t('registry.fans'), p.fans.toLocaleString('en')],
        ]}
      />
      {p.holdings.length > 0 && <HoldingsSection holdings={p.holdings} />}
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
          {p.business.mechanics.length > 0 && (
            <ul className="mt-2 space-y-1">
              {p.business.mechanics.map((m) => (
                <li key={m.id}>
                  <RegistryLink to={{ kind: 'person', person: 'staff', id: m.id }}>
                    {m.name}
                  </RegistryLink>{' '}
                  <span className="text-lc-dim">{t('registry.business.mechanic')}</span>
                </li>
              ))}
            </ul>
          )}
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

/** The paddock's people grouped by job (A to Z), by name within a job, with the years they were active if asked. */
function ByJob({ people, years = false }: { people: PersonRef[]; years?: boolean }) {
  const jobs = new Map<string, PersonRef[]>();
  for (const p of people) {
    const job = personRole(p.kind, p.role);
    jobs.set(job, [...(jobs.get(job) ?? []), p]);
  }
  if (jobs.size === 0) return <p className="text-lc-dim">{t('registry.paddock.none')}</p>;
  return (
    <div className="space-y-5">
      {[...jobs.keys()]
        .sort((a, b) => a.localeCompare(b))
        .map((job) => (
          <section key={job} className="space-y-2">
            <h3 className="lc-display text-sm text-lc-dim">
              {t('registry.paddock.job', { job, count: jobs.get(job)!.length })}
            </h3>
            <ul className="grid gap-1 sm:grid-cols-2">
              {jobs
                .get(job)!
                .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
                .map((p) => (
                  <li key={`${p.kind}-${p.id}`}>
                    {p.flag && (
                      <>
                        <Flag code={p.flag} />{' '}
                      </>
                    )}
                    <RegistryLink to={{ kind: 'person', person: p.kind, id: p.id }}>
                      {p.name}
                    </RegistryLink>{' '}
                    <span className="text-lc-dim">
                      {years ? `${p.years} ` : ''}
                      {p.lookingForWork ? t('registry.lookingForWork') : (p.garage ?? '')}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

const INDEX_TABS = ['drivers', 'cars', 'garages', 'paddock', 'exPaddock'] as const;
type IndexTab = (typeof INDEX_TABS)[number];

/** Every driver, car, garage and person in its own tab, with a search that narrows the open tab. */
function IndexPage({ data }: { data: RegistryIndex }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<IndexTab>('drivers');
  const q = query.trim().toLowerCase();
  const match = (...parts: (string | number | null)[]) =>
    q === '' || parts.some((x) => x !== null && String(x).toLowerCase().includes(q));
  const drivers = data.drivers.filter((d) => match(d.name, d.number, d.garage));
  const cars = data.cars.filter((c) => match(c.plate, c.model, c.plateState));
  const garages = data.garages.filter((g) => match(g.name));
  const people = data.people.filter((p) => match(p.name, p.garage, personRole(p.kind, p.role)));
  const paddock = people.filter((p) => p.status !== 'retired');
  const exPaddock = people.filter((p) => p.status === 'retired');
  const counts: Record<IndexTab, number> = {
    drivers: drivers.length,
    cars: cars.length,
    garages: garages.length,
    paddock: paddock.length,
    exPaddock: exPaddock.length,
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
        {tab === 'paddock' && <ByJob people={paddock} />}
        {tab === 'exPaddock' && <ByJob people={exPaddock} years />}
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
        : kind === 'supplier' || kind === 'utility'
          ? `person.role.${kind}`
          : `ownership.type.${role}`;
  return hasText(key) ? t(key as never) : role;
}

function HoldingsSection({ holdings }: { holdings: HoldingLine[] }) {
  return (
    <Section title={t('person.holdings')}>
      {holdings.length === 0 ? (
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
            {holdings.map((h) => (
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
  );
}

/** The facts of where a person is from and lives: their flag, hometown and residence. */
function originFacts(origin: Origin | null): [string, ReactNode][] {
  if (!origin) return [];
  const place = (l: PlaceLine | null): ReactNode =>
    l ? `${l.name}, ${l.region === l.name ? flagName(l.country) : l.region}` : t('registry.none');
  return [
    [
      t('person.flag'),
      <span key="flag" className="inline-flex items-center gap-2">
        <Flag code={origin.flag} /> {flagName(origin.flag)}
      </span>,
    ],
    [t('person.hometown'), place(origin.hometown)],
    [t('person.residence'), place(origin.residence)],
  ];
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
            ...originFacts(p.origin),
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
            ...(p.morale !== null
              ? ([[t('person.morale'), moraleText(p.morale)]] as [string, ReactNode][])
              : []),
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
            ...originFacts(p.origin),
            [t('person.skill'), p.skill],
            [t('person.wage'), formatMoney(p.wagePerWeek)],
            [t('person.hiredOn'), formatDate(p.hiredOn)],
            [
              t('person.status'),
              p.leftOn ? t('person.left', { date: formatDate(p.leftOn) }) : t('person.employed'),
            ],
            ...(p.morale !== null
              ? ([[t('person.morale'), moraleText(p.morale)]] as [string, ReactNode][])
              : []),
          ]}
        />
      </div>
    );
  if (p.kind !== 'shareholder')
    return (
      <div className="space-y-5 text-sm">
        <h2 className="lc-display text-lg">{p.name}</h2>
        <Facts
          items={[
            [t('person.role'), personRole(p.kind, p.kind)],
            ...(p.country
              ? ([
                  [
                    t('person.country'),
                    <span key="flag" className="inline-flex items-center gap-2">
                      <Flag code={p.country} /> {flagName(p.country)}
                    </span>,
                  ],
                ] as [string, ReactNode][])
              : []),
            ...(p.headquarters
              ? ([
                  [
                    t('person.headquarters'),
                    `${p.headquarters.name}, ${p.headquarters.region === p.headquarters.name ? flagName(p.headquarters.country) : p.headquarters.region}`,
                  ],
                ] as [string, ReactNode][])
              : []),
            ...(p.tier
              ? ([[t('person.tier'), t(`sponsors.tier.${p.tier}` as never)]] as [
                  string,
                  ReactNode,
                ][])
              : []),
            ...(p.category
              ? ([[t('person.category'), t(`supply.category.${p.category}` as never)]] as [
                  string,
                  ReactNode,
                ][])
              : []),
            [
              t('person.relationship'),
              p.relationship
                ? t('person.relationship.value', {
                    kind: t(`contacts.kind.${p.relationship.kind}` as never),
                    score: p.relationship.score,
                  })
                : t('person.relationship.none'),
            ],
          ]}
        />
        {(p.kind === 'sponsor' || p.kind === 'manufacturer') && (
          <HoldingsSection holdings={p.holdings} />
        )}
      </div>
    );
  return (
    <div className="space-y-5 text-sm">
      <h2 className="lc-display text-lg">{p.name}</h2>
      <Facts
        items={[
          [t('person.holderType'), personRole('shareholder', p.holderType)],
          ...originFacts(p.origin),
        ]}
      />
      {p.driver && (
        <p>
          <RegistryLink to={{ kind: 'driver', id: p.driver.id }}>
            {t('person.alsoDriver')}
          </RegistryLink>
        </p>
      )}
      <HoldingsSection holdings={p.holdings} />
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
    </div>
  );
}
