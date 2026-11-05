// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { IDENTITY_SIGN } from '../../sim/identity';
import type { Identity } from '../../sim/worldgen/types';
import { useCareerStore } from '../../state/career.store';
import { button, field, quiet } from '../styles';

/** Free agents to negotiate with, and the drivers already signed, who can be seated in an entry. */
export function DriversPanel() {
  const {
    agents,
    gear,
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
          {t('drivers.negotiating', {
            name: negotiation.name,
            fair: formatMoney(negotiation.fairValue),
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
              <span className="lc-num text-xs text-lc-dim">
                {t('drivers.stats', {
                  rating: a.rating,
                  pace: a.pace,
                  consistency: a.consistency,
                  racecraft: a.racecraft,
                  tyres: a.tyreManagement,
                  composure: a.composure,
                  wet: a.wetSkill,
                })}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="lc-num text-lc-dim">{formatMoney(a.fairValue)}</span>
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
    </div>
  );
}
