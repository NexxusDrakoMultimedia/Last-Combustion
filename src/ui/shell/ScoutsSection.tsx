// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { scoutWagePerRound, type ScoutFocus } from '../../sim/scouting';
import { scoutingBalance } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { button, quiet } from '../styles';

const FOCI: ScoutFocus[] = ['drivers', 'cars', 'garages'];

/** The scouts: who the garage employs, what each looks at, and who could be hired. */
export function ScoutsSection() {
  const { scouts, scoutOffers, agents, hub, status, hireScout, fireScout, assignScout } =
    useCareerStore();
  const [focus, setFocus] = useState<ScoutFocus>('drivers');
  const busy = status === 'busy';
  const cash = hub?.player?.cash ?? 0;
  const perRound = scouts.reduce((sum, s) => sum + s.wagePerRound, 0);
  const full = scouts.length >= scoutingBalance.staff.maxPerGarage;
  return (
    <div className="space-y-6 text-sm">
      <dl className="border border-lc-line bg-lc-raised p-3">
        <dt className="lc-display text-xs text-lc-dim">{t('scouts.wages')}</dt>
        <dd className="lc-num">{t('scouts.perRound', { amount: formatMoney(perRound) })}</dd>
      </dl>
      <p className="text-lc-dim">{t('scouts.explain')}</p>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('scouts.employed')}</h3>
        {scouts.length === 0 && <p className="text-lc-dim">{t('scouts.none')}</p>}
        <ul className="space-y-1">
          {scouts.map((s) => (
            <li key={s.id} className="space-y-2 border border-lc-line p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{s.name}</span>{' '}
                  <span className="text-lc-dim">{t('scouts.skill', { skill: s.skill })}</span>{' '}
                  <span className="text-lc-dim">{t(`scouts.focus.${s.focus}`)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="lc-num text-lc-dim">
                    {t('scouts.perYear', { amount: formatMoney(s.wagePerYear) })}
                  </span>
                  <button
                    type="button"
                    className={quiet}
                    disabled={busy || s.wagePerRound > cash}
                    onClick={() => void fireScout(s.id)}
                  >
                    {t('scouts.fire', { notice: formatMoney(s.wagePerRound) })}
                  </button>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-lc-dim">
                {s.assignment ? (
                  <>
                    <span>{t('scouts.assignedTo', { name: s.subjectName ?? '' })}</span>
                    <button
                      type="button"
                      className={quiet}
                      disabled={busy}
                      onClick={() => void assignScout(s.id, null)}
                    >
                      {t('scouts.clear')}
                    </button>
                  </>
                ) : (
                  <span>{t('scouts.covering', { kind: t(`scouts.focus.${s.focus}`) })}</span>
                )}
                {agents.length > 0 && (
                  <select
                    aria-label={t('scouts.assignDriver')}
                    className="border border-lc-line bg-lc-raised p-1"
                    value=""
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.value)
                        void assignScout(s.id, { kind: 'drivers', id: Number(e.target.value) });
                    }}
                  >
                    <option value="">{t('scouts.pickDriver')}</option>
                    {agents.map((a) => (
                      <option key={a.driverId} value={a.driverId}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('scouts.onOffer')}</h3>
        {full && (
          <p className="text-lc-dim">
            {t('scouts.full', { max: scoutingBalance.staff.maxPerGarage })}
          </p>
        )}
        <label className="flex items-center gap-2">
          <span className="text-lc-dim">{t('scouts.focus')}</span>
          <select
            className="border border-lc-line bg-lc-raised p-1"
            value={focus}
            onChange={(e) => setFocus(e.target.value as ScoutFocus)}
          >
            {FOCI.map((f) => (
              <option key={f} value={f}>
                {t(`scouts.focus.${f}`)}
              </option>
            ))}
          </select>
        </label>
        <ul className="space-y-1">
          {scoutOffers.map((o, i) => (
            <li
              key={`${o.name}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
            >
              <span>
                <span className="font-medium">{o.name}</span>{' '}
                <span className="text-lc-dim">{t('scouts.skill', { skill: o.skill })}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="lc-num text-lc-dim">
                  {t('scouts.wageOffer', {
                    year: formatMoney(o.wagePerYear),
                    round: formatMoney(scoutWagePerRound(o.wagePerYear)),
                  })}
                </span>
                <button
                  type="button"
                  className={button}
                  disabled={busy || full}
                  onClick={() => void hireScout(i, focus)}
                >
                  {t('scouts.hire')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
