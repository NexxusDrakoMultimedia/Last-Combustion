// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatMoney, t } from '../../i18n';
import { partWearFactor, repairFactor, wagePerRound } from '../../sim/staff';
import { useCareerStore } from '../../state/career.store';
import { RegistryLink } from '../RegistryLink';
import { button, quiet } from '../styles';

/** The mechanics: who the garage employs, what they cost and save, and who could be hired. */
export function StaffPanel() {
  const { staff, staffOffers, crew, entries, hub, status, hireMechanic, fireMechanic } =
    useCareerStore();
  const busy = status === 'busy';
  const cash = hub?.player?.cash ?? 0;
  const perRound = staff.reduce((sum, m) => sum + m.wagePerRound, 0);
  return (
    <div className="space-y-6 text-sm">
      <dl className="grid grid-cols-2 gap-2 border border-lc-line bg-lc-raised p-3 sm:grid-cols-4">
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('staff.crew')}</dt>
          <dd className="lc-num">{t('staff.crewValue', { percent: Math.round(crew * 100) })}</dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('staff.wear')}</dt>
          <dd className="lc-num">
            {t('staff.saving', { percent: Math.round((1 - partWearFactor(crew)) * 100) })}
          </dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('staff.repairs')}</dt>
          <dd className="lc-num">
            {t('staff.saving', { percent: Math.round((1 - repairFactor(crew)) * 100) })}
          </dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('staff.wages')}</dt>
          <dd className="lc-num">{t('staff.perRound', { amount: formatMoney(perRound) })}</dd>
        </div>
      </dl>
      <p className="text-lc-dim">{t('staff.explain', { entries: entries.length })}</p>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('staff.employed')}</h3>
        {staff.length === 0 && <p className="text-lc-dim">{t('staff.none')}</p>}
        <ul className="space-y-1">
          {staff.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
            >
              <span>
                <span className="font-medium">
                  <RegistryLink to={{ kind: 'person', person: 'staff', id: m.id }}>
                    {m.name}
                  </RegistryLink>
                </span>{' '}
                <span className="text-lc-dim">{t('staff.skill', { skill: m.skill })}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="lc-num text-lc-dim">
                  {t('staff.perWeek', { amount: formatMoney(m.wagePerWeek) })}
                </span>
                <button
                  type="button"
                  className={quiet}
                  disabled={busy || m.wagePerRound > cash}
                  onClick={() => void fireMechanic(m.id)}
                >
                  {t('staff.fire', { notice: formatMoney(m.wagePerRound) })}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('staff.onOffer')}</h3>
        <ul className="space-y-1">
          {staffOffers.map((o, i) => (
            <li
              key={`${o.name}-${i}`}
              className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
            >
              <span>
                <span className="font-medium">{o.name}</span>{' '}
                <span className="text-lc-dim">{t('staff.skill', { skill: o.skill })}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="lc-num text-lc-dim">
                  {t('staff.wageOffer', {
                    week: formatMoney(o.wagePerWeek),
                    round: formatMoney(wagePerRound(o.wagePerWeek)),
                  })}
                </span>
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => void hireMechanic(i)}
                >
                  {t('staff.hire')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
