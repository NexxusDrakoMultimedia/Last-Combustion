// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import type { PartCategory } from '../../sim/upgrades';
import { upgradeBalance } from '../../sim/worldgen/data';
import { button, field, quiet } from '../styles';

const CATEGORIES: PartCategory[] = [
  'engine',
  'intake_exhaust',
  'forced_induction',
  'ecu',
  'drivetrain',
  'suspension',
  'brakes',
  'weight_reduction',
  'aero',
  'wheels',
];

/** Fit and remove parts on the garage's cars, with the legality budget and scrutineering shown. */
export function UpgradesPanel() {
  const { upgrades, hub, status, fitPart, removePart, serviceParts } = useCareerStore();
  const [carId, setCarId] = useState<number | null>(null);
  const view = upgrades.find((u) => u.carId === carId) ?? upgrades[0];
  const cash = hub?.player?.cash ?? 0;
  const busy = status === 'busy';
  if (!view) return <p className="text-sm text-lc-dim">{t('upgrades.noCars')}</p>;

  const budget = upgradeBalance.legalityBudget;
  const legalColour = view.legality >= 0 ? 'text-lc-good' : 'text-lc-bad';

  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm" htmlFor="upgrade-car">
        {t('upgrades.car')}
        <select
          id="upgrade-car"
          className={field}
          value={view.carId}
          onChange={(e) => setCarId(Number(e.target.value))}
        >
          {upgrades.map((u) => (
            <option key={u.carId} value={u.carId}>
              {t('upgrades.carOption', { state: u.plateState, plate: u.plate, model: u.modelName })}
            </option>
          ))}
        </select>
      </label>
      <dl className="grid grid-cols-2 gap-2 border border-lc-line bg-lc-raised p-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('upgrades.kerb')}</dt>
          <dd className="lc-num">{t('upgrades.kg', { kg: view.kerbKg })}</dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('upgrades.tyres')}</dt>
          <dd className="lc-num">
            {t('upgrades.tyreWidth', { width: view.tyreWidthMm, max: view.maxTyreMm })}
          </dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('upgrades.legality')}</dt>
          <dd className={`lc-num ${legalColour}`}>
            {t('upgrades.legalityScore', { score: view.legality, budget })}
          </dd>
        </div>
        <div>
          <dt className="lc-display text-xs text-lc-dim">{t('upgrades.scrutineering')}</dt>
          <dd className={view.scrutineering.legal ? 'text-lc-good' : 'text-lc-bad'}>
            {view.scrutineering.legal
              ? t('upgrades.passes')
              : view.scrutineering.failures.map((f) => t(`upgrades.fail.${f}`)).join(', ')}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {view.serviceCost > 0 ? (
          <button
            type="button"
            className={button}
            disabled={busy || view.serviceCost > cash}
            onClick={() => void serviceParts(view.carId)}
          >
            {t('upgrades.service', { cost: formatMoney(view.serviceCost) })}
          </button>
        ) : (
          <span className="text-lc-dim">{t('upgrades.serviceNone')}</span>
        )}
      </div>
      {CATEGORIES.map((category) => (
        <section key={category} className="space-y-1">
          <h3 className="lc-display text-sm text-lc-dim">{t(`part.category.${category}`)}</h3>
          <ul className="space-y-1 text-sm">
            {view.offers
              .filter((o) => o.part.category === category)
              .map((o) => (
                <li
                  key={o.part.id}
                  className={`flex flex-wrap items-center justify-between gap-2 border p-2 ${
                    o.fitted ? 'border-lc-accent-ink bg-lc-raised' : 'border-lc-line'
                  }`}
                >
                  <span>
                    <span className="font-medium">{o.part.name}</span>{' '}
                    <span className="text-lc-dim">
                      {t('upgrades.gradeSupplier', {
                        grade: t(`part.grade.${o.part.grade}`),
                        supplier: o.supplier,
                      })}
                    </span>
                    <br />
                    <span className="lc-num text-xs text-lc-dim">
                      {t('upgrades.effects', {
                        power: Math.round(o.part.psPct * 100),
                        kg: o.part.deltaKg,
                        grip: o.part.deltaGrip,
                        handling: o.part.deltaHandling,
                        traction: o.part.deltaTraction,
                        legality: o.part.legalityCost,
                      })}
                    </span>
                    {o.wear !== null && (
                      <>
                        <br />
                        <span
                          className={`lc-num text-xs ${o.wear >= 70 ? 'text-lc-bad' : 'text-lc-dim'}`}
                        >
                          {t('upgrades.partWear', { wear: Math.round(o.wear) })}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="lc-num">{formatMoney(o.price)}</span>
                    {o.fitted ? (
                      <button
                        type="button"
                        className={quiet}
                        disabled={busy}
                        onClick={() => void removePart(view.carId, o.part.category)}
                      >
                        {t('upgrades.remove')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={button}
                        disabled={busy || o.price > cash}
                        onClick={() => void fitPart(view.carId, o.part.id)}
                      >
                        {t('upgrades.fit')}
                      </button>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
