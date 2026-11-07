// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { executiveBonuses, salaryPerRound, type ExecutiveRole } from '../../sim/executives';
import { executiveData } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { button, field, quiet } from '../styles';

const pct = (x: number): number => Math.round(x * 1000) / 10;

/** What an executive of some role and skill does for the garage, in words. */
export function describeExecutive(role: ExecutiveRole, skill: number): string {
  const b = executiveBonuses([{ role, skill }]);
  switch (role) {
    case 'chief_executive':
      return t('executive.effect.chief_executive', {
        others: pct((executiveData.roles.chief_executive.max.othersBonus * skill) / 100),
      });
    case 'commercial_director':
      return t('executive.effect.commercial_director', {
        fee: pct(b.sponsorFee),
        points: b.sponsorPrestige,
      });
    case 'contracts_director':
      return t(
        b.extraPatience
          ? 'executive.effect.contracts_director_patient'
          : 'executive.effect.contracts_director',
        { leverage: Math.round(b.leverage * 1000) / 1000 },
      );
    case 'head_of_marketing':
      return t('executive.effect.head_of_marketing', {
        fans: pct(b.fans),
        merchandise: pct(b.merchandise),
      });
    case 'finance_director':
      return t('executive.effect.finance_director', {
        premium: pct(b.auctionPremium),
        fee: pct(b.auctionFee),
      });
    case 'technical_director':
      return t('executive.effect.technical_director', {
        price: pct(b.partPrice),
        wear: pct(b.partWear),
      });
    case 'sporting_director':
      return t('executive.effect.sporting_director', {
        training: pct(b.training),
        gear: pct(b.gearCost),
      });
    case 'operations_director':
      return t('executive.effect.operations_director', {
        utilities: pct(b.utilities),
        outages: pct(b.outages),
      });
    default:
      return t('executive.effect.none');
  }
}

/** The executives: who the garage employs and what they bring, the free slots, and who could be hired. */
export function ExecutivesSection() {
  const {
    executives,
    executiveCapacity,
    executiveOffers,
    executiveNegotiation,
    hub,
    status,
    negotiateExecutive,
    offerExecutive,
    endExecutiveNegotiation,
    dismissExecutive,
  } = useCareerStore();
  const [salary, setSalary] = useState('');
  const [years, setYears] = useState('2');
  const busy = status === 'busy';
  const cash = hub?.player?.cash ?? 0;
  const [minYears, maxYears] = executiveData.contractYears as [number, number];

  if (executiveNegotiation) {
    const n = executiveNegotiation;
    const accepted = n.last?.kind === 'accepted';
    const walked = n.last?.kind === 'walked';
    const counter = n.last?.kind === 'countered' ? n.last.counter : undefined;
    return (
      <div className="space-y-4 text-sm">
        <p>
          {t('executive.negotiating', {
            name: n.name,
            role: t(`executive.role.${n.role}` as never),
            fair: formatMoney(n.fairValue),
            patience: n.patience,
          })}
        </p>
        <p className="text-lc-dim">{describeExecutive(n.role, n.skill)}</p>
        {counter && (
          <p className="border border-lc-line bg-lc-raised p-2">
            {t('executive.counter', {
              salary: formatMoney(counter.salary),
              years: counter.years,
            })}
          </p>
        )}
        {accepted && <p className="text-lc-good">{t('executive.accepted', { name: n.name })}</p>}
        {walked && <p className="text-lc-bad">{t('executive.walked', { name: n.name })}</p>}
        {!accepted && !walked && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1" htmlFor="exec-salary">
              {t('executive.salary')}
              <input
                id="exec-salary"
                className={field}
                inputMode="numeric"
                value={salary}
                onChange={(e) => setSalary(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
            <label className="space-y-1" htmlFor="exec-years">
              {t('executive.years')}
              <select
                id="exec-years"
                className={field}
                value={years}
                onChange={(e) => setYears(e.target.value)}
              >
                {Array.from({ length: maxYears - minYears + 1 }, (_, i) => minYears + i).map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ),
                )}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className={button}
                disabled={busy || salary === ''}
                onClick={() => void offerExecutive(Number(salary), Number(years))}
              >
                {t('executive.offer')}
              </button>
            </div>
          </div>
        )}
        <button type="button" className={quiet} onClick={endExecutiveNegotiation}>
          {t('executive.back')}
        </button>
      </div>
    );
  }

  const full = executiveCapacity.used >= executiveCapacity.slots;
  return (
    <div className="space-y-6 text-sm">
      <p className="border border-lc-line bg-lc-raised p-3">
        {t('executive.capacity', {
          used: executiveCapacity.used,
          slots: executiveCapacity.slots,
          first: executiveData.firstSlotPrestige,
          per: executiveData.prestigePerSlot,
        })}
      </p>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('executive.employed')}</h3>
        {executives.length === 0 && <p className="text-lc-dim">{t('executive.none')}</p>}
        <ul className="space-y-1">
          {executives.map((e) => (
            <li key={e.id} className="space-y-1 border border-lc-line p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{e.name}</span>{' '}
                  <span className="text-lc-dim">
                    {t('executive.who', {
                      role: t(`executive.role.${e.role}` as never),
                      age: e.age,
                      skill: e.skill,
                    })}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="lc-num text-lc-dim">
                    {t('executive.paid', {
                      salary: formatMoney(e.salary),
                      round: formatMoney(salaryPerRound(e.salary)),
                      year: e.endYear,
                    })}
                  </span>
                  <button
                    type="button"
                    className={quiet}
                    disabled={busy || Math.round(e.salary / 2) > cash}
                    onClick={() => void dismissExecutive(e.id)}
                  >
                    {t('executive.dismiss', { notice: formatMoney(Math.round(e.salary / 2)) })}
                  </button>
                </span>
              </div>
              <p className="text-lc-dim">{describeExecutive(e.role, e.skill)}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h3 className="lc-display text-sm text-lc-dim">{t('executive.onOffer')}</h3>
        {full && <p className="text-lc-dim">{t('executive.noSlot')}</p>}
        {executiveOffers.map(({ role, offers }) => (
          <div key={role} className="space-y-1">
            <h4 className="font-medium">{t(`executive.role.${role}` as never)}</h4>
            <ul className="space-y-1">
              {offers.map((o, i) => (
                <li
                  key={`${o.name}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
                >
                  <span>
                    <span className="font-medium">{o.name}</span>{' '}
                    <span className="text-lc-dim">
                      {t('executive.candidate', { age: o.age, skill: o.skill })}
                    </span>
                    <br />
                    <span className="text-xs text-lc-dim">{describeExecutive(role, o.skill)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="lc-num text-lc-dim">
                      {t('executive.asks', { salary: formatMoney(o.salary) })}
                    </span>
                    <button
                      type="button"
                      className={quiet}
                      disabled={busy || full}
                      onClick={() => void negotiateExecutive(role, i)}
                    >
                      {t('executive.negotiate')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
