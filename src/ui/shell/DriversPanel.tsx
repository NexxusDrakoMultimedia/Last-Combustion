// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { DriverStats, salaryText } from './DriverStats';
import { formatMoney, t } from '../../i18n';
import { IDENTITY_SIGN } from '../../sim/identity';
import type { Identity } from '../../sim/worldgen/types';
import { useCareerStore } from '../../state/career.store';
import { places, seasonBalance } from '../../sim/worldgen/data';
import { button, field, quiet } from '../styles';
import { RivalriesSection } from './RivalriesSection';
import { StorylinesSection } from './StorylinesSection';

/** Every place a driver could move to: Australia first, then the rest by country and name. */
const PLACE_OPTIONS = [...places]
  .sort(
    (a, b) =>
      Number(b.country === 'AU') - Number(a.country === 'AU') ||
      a.country.localeCompare(b.country, 'en') ||
      a.name.localeCompare(b.name, 'en'),
  )
  .map((p) => ({
    id: p.id,
    label: `${p.name}, ${p.region}${p.country === 'AU' ? '' : ` (${p.country})`}`,
  }));

/** Free agents to negotiate with, and the drivers already signed, who can be seated in an entry. */
export function DriversPanel() {
  const {
    agents,
    gear,
    trained,
    daily,
    setTraining,
    moveDriverHome,
    negotiation,
    hub,
    status,
    negotiate,
    offerContract,
    endNegotiation,
    seatDriver,
    renewGear,
  } = useCareerStore();
  const [salary, setSalary] = useState('');
  const [years, setYears] = useState('2');
  const [share, setShare] = useState('80');
  const busy = status === 'busy';
  const started = hub?.rounds.some((r) => r.status !== 'scheduled') ?? false;

  if (negotiation) {
    const accepted = negotiation.last?.kind === 'accepted';
    const walked = negotiation.last?.kind === 'walked';
    const counter = negotiation.last?.kind === 'countered' ? negotiation.last.counter : undefined;
    return (
      <div className="space-y-4">
        <p className="text-sm">
          {negotiation.fair
            ? t('drivers.negotiating', {
                name: negotiation.name,
                fair: salaryText(negotiation.fair),
                patience: negotiation.patience,
              })
            : t('drivers.negotiatingBlind', {
                name: negotiation.name,
                patience: negotiation.patience,
              })}
        </p>
        {counter && (
          <p className="border border-lc-line bg-lc-raised p-2 text-sm">
            {t('drivers.counter', {
              salary: formatMoney(counter.salary),
              years: counter.years,
              share: Math.round((counter.garageShare ?? 0.8) * 100),
            })}
          </p>
        )}
        {accepted && (
          <p className="text-lc-good">{t('drivers.accepted', { name: negotiation.name })}</p>
        )}
        {walked && <p className="text-lc-bad">{t('drivers.walked', { name: negotiation.name })}</p>}
        {!accepted && !walked && (
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-sm" htmlFor="offer-salary">
              {t('drivers.salary')}
              <input
                id="offer-salary"
                className={field}
                inputMode="numeric"
                value={salary}
                onChange={(e) => setSalary(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label className="space-y-1 text-sm" htmlFor="offer-years">
              {t('drivers.years')}
              <select
                id="offer-years"
                className={field}
                value={years}
                onChange={(e) => setYears(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm" htmlFor="offer-share">
              {t('drivers.share')}
              <select
                id="offer-share"
                className={field}
                value={share}
                onChange={(e) => setShare(e.target.value)}
              >
                {[30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                  <option key={p} value={p}>
                    {t('drivers.shareOption', { percent: p })}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className={button}
                disabled={busy || salary === ''}
                onClick={() =>
                  void offerContract(Number(salary), Number(years), Number(share) / 100)
                }
              >
                {t('drivers.offer')}
              </button>
            </div>
          </div>
        )}
        <button type="button" className={quiet} onClick={endNegotiation}>
          {t('drivers.back')}
        </button>
      </div>
    );
  }

  const cash = hub?.player?.cash ?? 0;
  return (
    <div className="space-y-6">
      <p className="text-sm text-lc-dim">{t('drivers.fogNote')}</p>
      <ul className="space-y-2 text-sm">
        {agents.length === 0 && <li className="text-lc-dim">{t('drivers.none')}</li>}
        {agents.map((a) => (
          <li
            key={a.driverId}
            className="flex flex-wrap items-center justify-between gap-2 border border-lc-line bg-lc-raised p-2"
          >
            <span>
              <span className="font-medium">
                {a.name} {IDENTITY_SIGN[a.identity as Identity]}
              </span>{' '}
              <span className="text-lc-dim">{t('drivers.age', { age: a.age })}</span>
              <br />
              <DriverStats reading={a.reading} />
            </span>
            <span className="flex items-center gap-2">
              <span className="lc-num text-lc-dim">{salaryText(a.fairSalary)}</span>
              {a.signed ? (
                <button
                  type="button"
                  className={button}
                  disabled={busy || started}
                  onClick={() => void seatDriver(a.driverId)}
                >
                  {t('drivers.seat')}
                </button>
              ) : (
                <button
                  type="button"
                  className={quiet}
                  disabled={busy}
                  onClick={() => void negotiate(a.driverId)}
                >
                  {t('drivers.negotiate')}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {trained.length > 0 && (
        <section className="space-y-2 text-sm">
          <h3 className="lc-display text-sm text-lc-dim">{t('drivers.trainingTitle')}</h3>
          <p className="text-lc-dim">{t('drivers.trainingIntro')}</p>
          <ul className="space-y-1">
            {trained.map((d) => (
              <li
                key={d.driverId}
                className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
              >
                <span className="font-medium">
                  {t('drivers.trainingDriver', { name: d.name, age: d.age })}
                </span>
                <select
                  aria-label={t('drivers.trainingLevel')}
                  className={field}
                  disabled={busy}
                  value={d.training}
                  onChange={(e) => void setTraining(d.driverId, Number(e.target.value))}
                >
                  {seasonBalance.training.levels.map((l, i) => (
                    <option key={i} value={i}>
                      {t('drivers.trainingOption', {
                        name: t(`training.level.${i}` as never),
                        cost: formatMoney(l.cost),
                      })}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}
      {daily && daily.drivers.length > 0 && (
        <section className="space-y-2 text-sm">
          <h3 className="lc-display text-sm text-lc-dim">{t('daily.title')}</h3>
          <p className="text-lc-dim">{t('daily.intro')}</p>
          {daily.nextGap && (
            <p className="lc-num">
              {t('daily.nextGap', {
                round: daily.nextGap.round,
                days: daily.nextGap.days,
                income: formatMoney(daily.nextGap.income),
              })}
            </p>
          )}
          <ul className="space-y-1">
            {daily.drivers.map((d) => (
              <li key={d.driverId} className="space-y-1 border border-lc-line p-2">
                <p>
                  <span className="font-medium">{d.name}</span>{' '}
                  <span className="text-lc-dim">
                    {t('daily.lives', { place: d.residence })}{' '}
                    {t('daily.roads', {
                      road: t(`road.${d.roadType}` as never),
                      rating: Math.round(d.affinity),
                      factor: d.areaFactor,
                    })}
                  </span>
                </p>
                {d.movingTo && (
                  <p className="text-lc-warn">{t('daily.moving', { place: d.movingTo })}</p>
                )}
                {daily.canMove && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={t('daily.moveTo', { name: d.name })}
                      className={field}
                      disabled={busy}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) void moveDriverHome(d.driverId, e.target.value);
                      }}
                    >
                      <option value="">{t('daily.move', { cost: formatMoney(daily.cost) })}</option>
                      {PLACE_OPTIONS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {gear.length > 0 && (
        <section className="space-y-2 text-sm">
          <h3 className="lc-display text-sm text-lc-dim">{t('drivers.gearTitle')}</h3>
          <p className="text-lc-dim">{t('drivers.gearIntro')}</p>
          <ul className="space-y-1">
            {gear.map((g) => (
              <li
                key={`${g.driverId}-${g.itemId}`}
                className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
              >
                <span>
                  <span className="font-medium">{g.driverName}</span>
                  <br />
                  <span
                    className={`lc-num text-xs ${g.wear >= 70 ? 'text-lc-bad' : 'text-lc-dim'}`}
                  >
                    {t('drivers.gearItem', {
                      name: g.name,
                      tier: t(`gear.tier.${g.tier}`),
                      wear: Math.round(g.wear),
                    })}
                  </span>
                </span>
                {g.renewCost === null ? (
                  <span className="text-xs text-lc-dim">{t('drivers.renewNone')}</span>
                ) : (
                  <button
                    type="button"
                    className={quiet}
                    disabled={busy || g.wear <= 0 || g.renewCost > cash}
                    onClick={() => void renewGear(g.driverId, g.itemId)}
                  >
                    {t('drivers.renew', { cost: formatMoney(g.renewCost) })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <RivalriesSection />
      <StorylinesSection />
    </div>
  );
}
