// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { MAX_PREMIUM, sharesPrice, takeoverQuote } from '../../sim/equity';
import { useCareerStore } from '../../state/career.store';
import { RegistryLink } from '../RegistryLink';
import { button, field, quiet } from '../styles';

const pct = (x: number): number => Math.round(x * 1000) / 10;
const pctText = (x: number): string => `${pct(x)}%`;

/** The owner's wealth outside the garage: personal cash, shares in other garages, and bids for whole garages. */
export function InvestmentsSection() {
  const {
    wealth,
    investments,
    investment,
    hub,
    status,
    loadInvestments,
    lookAtInvestment,
    buyStake,
    sellStake,
    launchTakeover,
  } = useCareerStore();
  const [premium, setPremium] = useState('25');
  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);
  const busy = status === 'busy';
  if (!wealth) return <p className="text-sm text-lc-dim">{t('ownership.none')}</p>;
  const garageCash = hub?.player?.cash ?? 0;
  const quote = investment
    ? takeoverQuote(
        investment.holders.map((h) => ({
          id: h.id,
          type: h.type,
          name: h.name,
          shares: h.shares,
          class: h.class,
          reserve: h.reserve,
          mine: h.mine,
        })),
        investment.valuation,
        Math.min(MAX_PREMIUM, (Number(premium) || 0) / 100),
      )
    : undefined;
  const mine = investment?.holders.filter((h) => h.mine && h.class !== 'option') ?? [];
  const mineShares = mine.reduce((s, h) => s + h.shares, 0);
  return (
    <div className="space-y-6 text-sm">
      <p className="text-lc-dim">{t('investments.intro')}</p>

      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('investments.wealth')}</h3>
        <dl className="grid grid-cols-3 gap-2 border border-lc-line bg-lc-raised p-3">
          <div>
            <dt className="lc-display text-xs text-lc-dim">{t('investments.cash')}</dt>
            <dd className="lc-num">{formatMoney(wealth.personalCash)}</dd>
          </div>
          <div>
            <dt className="lc-display text-xs text-lc-dim">{t('investments.holdings')}</dt>
            <dd className="lc-num">{formatMoney(wealth.total - wealth.personalCash)}</dd>
          </div>
          <div>
            <dt className="lc-display text-xs text-lc-dim">{t('investments.total')}</dt>
            <dd className="lc-num">{formatMoney(wealth.total)}</dd>
          </div>
        </dl>
        {wealth.holdings.length === 0 ? (
          <p className="text-lc-dim">{t('investments.none')}</p>
        ) : (
          <ul className="space-y-1">
            {wealth.holdings.map((h) => (
              <li key={`${h.garageId}-${h.class}`} className="border-t border-lc-line py-1">
                <RegistryLink to={{ kind: 'garage', id: h.garageId }}>{h.name}</RegistryLink>{' '}
                <span className="text-lc-dim">
                  {t('investments.holding', {
                    shares: h.shares.toLocaleString('en-AU'),
                    class: t(`ownership.class.${h.class}` as never).toLowerCase(),
                    stake: pct(h.stake),
                    worth: formatMoney(h.worth),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <label className="block space-y-1" htmlFor="investment-garage">
          {t('investments.garage')}
          <select
            id="investment-garage"
            className={field}
            value={investment?.garageId ?? ''}
            onChange={(e) =>
              lookAtInvestment(e.target.value === '' ? null : Number(e.target.value))
            }
          >
            <option value="">{t('investments.choose')}</option>
            {investments.map((g) => (
              <option key={g.id} value={g.id}>
                {g.stake > 0
                  ? t('investments.optionStake', {
                      name: g.name,
                      worth: formatMoney(g.valuation),
                      stake: pctText(g.stake),
                    })
                  : t('investments.option', { name: g.name, worth: formatMoney(g.valuation) })}
              </option>
            ))}
          </select>
        </label>

        {investment && quote && (
          <div className="space-y-4">
            <p className="lc-num text-lc-dim">
              {t('investments.valuation', { amount: formatMoney(investment.valuation) })}
              {mineShares > 0 &&
                ' ' +
                  t('investments.target.stake', {
                    stake: pct(mineShares / Math.max(1, investment.issued)),
                  })}
            </p>
            <table className="w-full">
              <caption className="sr-only">{investment.name}</caption>
              <thead>
                <tr className="text-left text-lc-dim">
                  <th className="lc-display py-1 text-xs">{t('investments.holder')}</th>
                  <th className="lc-display py-1 text-xs">{t('ownership.class')}</th>
                  <th className="lc-display py-1 text-right text-xs">{t('ownership.stake')}</th>
                  <th className="lc-display py-1 text-right text-xs">{t('ownership.votes')}</th>
                  <th className="lc-display py-1 text-right text-xs">
                    {t('investments.holder.asks')}
                  </th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {investment.holders.map((h) => (
                  <tr key={h.id} className="border-t border-lc-line">
                    <td className="py-1">
                      <span className="font-medium">{h.name}</span>{' '}
                      <span className="text-lc-dim">{t(`ownership.type.${h.type}` as never)}</span>
                    </td>
                    <td className="py-1">{t(`ownership.class.${h.class}` as never)}</td>
                    <td className="lc-num py-1 text-right">{pctText(h.stake)}</td>
                    <td className="lc-num py-1 text-right">{pctText(h.votes)}</td>
                    <td className="lc-num py-1 text-right">
                      {h.mine || h.class === 'option'
                        ? ''
                        : t('investments.holder.premium', { percent: Math.round(h.reserve * 100) })}
                    </td>
                    <td className="py-1 text-right">
                      {h.mine ? (
                        <span className="text-lc-dim">{t('investments.mine')}</span>
                      ) : (
                        h.class !== 'option' && (
                          <button
                            type="button"
                            className={quiet}
                            disabled={busy || h.asking > wealth.personalCash}
                            onClick={() => void buyStake(h.id)}
                          >
                            {t('investments.buy', { price: formatMoney(h.asking) })}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {mineShares > 0 && (
              <div className="space-y-1">
                <p className="text-lc-dim">{t('investments.sell.explain')}</p>
                <button
                  type="button"
                  className={quiet}
                  disabled={busy}
                  onClick={() => void sellStake(investment.garageId)}
                >
                  {t('investments.sell', {
                    price: formatMoney(
                      sharesPrice(investment.valuation, investment.issued, mineShares),
                    ),
                  })}
                </button>
              </div>
            )}

            <div className="space-y-2 border border-lc-line p-3">
              <h4 className="lc-display text-xs text-lc-dim">{t('investments.takeover')}</h4>
              <p className="text-lc-dim">{t('investments.takeover.explain')}</p>
              <label className="block space-y-1" htmlFor="takeover-premium">
                {t('investments.takeover.premium')}
                <input
                  id="takeover-premium"
                  className={field}
                  inputMode="numeric"
                  value={premium}
                  onChange={(e) => setPremium(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </label>
              <p className="lc-num">
                {t('investments.takeover.quote', {
                  premium: Number(premium) || 0,
                  price: formatMoney(Math.round(quote.pricePerShare * 100) / 100),
                  votes: pct(quote.votes),
                  cost: formatMoney(quote.cost),
                })}
              </p>
              <p>
                {t(
                  quote.boardSupports
                    ? 'investments.takeover.board.supports'
                    : 'investments.takeover.board.fights',
                )}{' '}
                {t(quote.success ? 'investments.takeover.carries' : 'investments.takeover.fails')}
              </p>
              {!investment.takeoverOpen && (
                <p className="text-lc-dim">{t('investments.takeover.closed')}</p>
              )}
              {quote.success && quote.cost > garageCash && (
                <p className="text-lc-bad">{t('investments.takeover.afford')}</p>
              )}
              <button
                type="button"
                className={button}
                disabled={
                  busy || !investment.takeoverOpen || !quote.success || quote.cost > garageCash
                }
                onClick={() =>
                  void launchTakeover(investment.garageId, (Number(premium) || 0) / 100)
                }
              >
                {t('investments.takeover.button', { cost: formatMoney(quote.cost) })}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
