// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { supplyData } from '../../sim/worldgen/data';
import { useCareerStore } from '../../state/career.store';
import { button, field, quiet } from '../styles';

const pct = (x: number): number => Math.round(x * 1000) / 10;

/** The operating suppliers: each category's market, the garage's price and contract, and the negotiation over a discount. */
export function SupplyPanel() {
  const { supply, supplyNegotiation, status, negotiateSupply, offerSupply, endSupplyNegotiation } =
    useCareerStore();
  const [discount, setDiscount] = useState('');
  const [years, setYears] = useState('1');
  const busy = status === 'busy';

  if (supplyNegotiation) {
    const last = supplyNegotiation.last;
    const accepted = last?.kind === 'accepted';
    const walked = last?.kind === 'walked';
    const counter = last?.kind === 'countered' ? last.counter : undefined;
    return (
      <div className="space-y-4 text-sm">
        <p>
          {t('supply.negotiating', {
            name: supplyNegotiation.name,
            category: t(`supply.category.${supplyNegotiation.category}` as never),
            fair: pct(supplyNegotiation.fairValue),
            patience: supplyNegotiation.patience,
          })}
        </p>
        {counter && (
          <p className="border border-lc-line bg-lc-raised p-2">
            {t('supply.counter', { discount: pct(counter.discount), years: counter.years })}
          </p>
        )}
        {accepted && (
          <p className="text-lc-good">{t('supply.accepted', { name: supplyNegotiation.name })}</p>
        )}
        {walked && (
          <p className="text-lc-bad">{t('supply.walked', { name: supplyNegotiation.name })}</p>
        )}
        {!accepted && !walked && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1" htmlFor="supply-discount">
              {t('supply.discount')}
              <input
                id="supply-discount"
                className={field}
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </label>
            <label className="space-y-1" htmlFor="supply-years">
              {t('supply.years')}
              <select
                id="supply-years"
                className={field}
                value={years}
                onChange={(e) => setYears(e.target.value)}
              >
                {Array.from({ length: supplyData.maxYears }, (_, i) => i + 1).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className={button}
                disabled={busy || discount === '' || Number.isNaN(Number(discount))}
                onClick={() => void offerSupply(Number(discount) / 100, Number(years))}
              >
                {t('supply.offer')}
              </button>
            </div>
          </div>
        )}
        <button type="button" className={quiet} onClick={endSupplyNegotiation}>
          {t('supply.back')}
        </button>
      </div>
    );
  }

  if (!supply) return null;
  return (
    <div className="space-y-6 text-sm">
      <p className="text-lc-dim">
        {t('supply.explain')}
        {supply.saving > 0 && ' ' + t('supply.saving', { percent: pct(supply.saving) })}
      </p>
      {supply.categories.map((c) => (
        <section key={c.category} className="space-y-2 border border-lc-line p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="lc-display text-sm">{t(`supply.category.${c.category}` as never)}</h3>
            <span className="lc-num text-lc-dim">
              {t('supply.market', { percent: Math.round(c.market * 100) })}
              {c.shock && ' ' + t('supply.shock')}
            </span>
          </div>
          <p className="lc-num">
            {c.contract
              ? t('supply.contract', {
                  name: c.contract.supplierName,
                  discount: pct(c.contract.discount),
                  rate: Math.round(c.rate * 100),
                  year: c.contract.endYear,
                })
              : t('supply.spot', { rate: Math.round(c.rate * 100) })}{' '}
            <span className="text-lc-dim">
              {t('supply.nextRound', { amount: formatMoney(c.nextRound) })}
            </span>
          </p>
          {!c.contract && (
            <ul className="space-y-1">
              {c.suppliers.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
                >
                  <span>
                    <span className="font-medium">{s.name}</span>{' '}
                    <span className="text-lc-dim">
                      {t('supply.supplier', {
                        tier: t(`supply.tier.${s.tier}` as never),
                        index: Math.round(s.priceIndex * 100),
                        reliability: Math.round(s.reliability * 100),
                      })}
                    </span>
                  </span>
                  {s.eligible ? (
                    <button
                      type="button"
                      className={quiet}
                      disabled={busy}
                      onClick={() => void negotiateSupply(s.id)}
                    >
                      {t('supply.negotiate')}
                    </button>
                  ) : (
                    <span className="text-xs text-lc-dim">
                      {t('supply.ineligible', { prestige: s.minPrestige })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
