// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState } from 'react';
import { formatMoney, t } from '../../i18n';
import { MAX_PREMIUM } from '../../sim/equity';
import { useCareerStore } from '../../state/career.store';
import { FogShare } from '../FogValue';
import { RegistryLink } from '../RegistryLink';
import { button, field, quiet } from '../styles';
import { amountText } from './DriverStats';

const pct = (x: number): number => Math.round(x * 1000) / 10;
const pctText = (x: number): string => `${pct(x)}%`;
const voteText = (low: number, high: number): string =>
  low === high ? pctText(low) : t('fog.range', { low: pctText(low), high: pctText(high) });

/** The owner's wealth outside the garage: personal cash, shares in other garages, and bids for whole garages. */
export function InvestmentsSection() {
  const {
    wealth,
    investments,
    investment,
    takeoverEstimate: quote,
    hub,
    status,
    loadInvestments,
    lookAtInvestment,
    estimateTakeover,
    buyStake,
    sellStake,
    launchTakeover,
  } = useCareerStore();
  const [premium, setPremium] = useState('25');
  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);
  const bid = Math.min(MAX_PREMIUM, (Number(premium) || 0) / 100);
  // What a bid would do is worked out in the data layer and comes back as an estimate: the true
  // numbers behind it never reach the screen.
  const garageId = investment?.garageId;
  useEffect(() => {
    if (garageId !== undefined) estimateTakeover(garageId, bid);
  }, [garageId, investment, bid, estimateTakeover]);
  const busy = status === 'busy';
  if (!wealth) return <p className="text-sm text-lc-dim">{t('ownership.none')}</p>;
  const garageCash = hub?.player?.cash ?? 0;
  const mineStake = investment?.mineStake ?? 0;
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
            <dd className="lc-num">{amountText(wealth.holdingsWorth)}</dd>
          </div>
          <div>
            <dt className="lc-display text-xs text-lc-dim">{t('investments.total')}</dt>
            <dd className="lc-num">{amountText(wealth.total)}</dd>
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
                    worth: amountText(h.worth),
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
                      worth: amountText(g.valuation),
                      stake: pctText(g.stake),
                    })
                  : t('investments.option', { name: g.name, worth: amountText(g.valuation) })}
              </option>
            ))}
          </select>
        </label>

        {investment && (
          <div className="space-y-4">
            <p className="lc-num text-lc-dim">
              {t('investments.valuation', { amount: amountText(investment.valuation) })}
              {mineStake > 0 && ' ' + t('investments.target.stake', { stake: pct(mineStake) })}
            </p>
            <p>
              {investment.leader !== null &&
                t(
                  investment.hasMajority
                    ? 'investments.cap.majority'
                    : 'investments.cap.noMajority',
                  { name: investment.leader },
                )}{' '}
              <span className="text-lc-dim">
                {t(`investments.cap.tier.${investment.tier}` as never)}
              </span>
            </p>
            <table className="w-full">
              <caption className="sr-only">{investment.name}</caption>
              <thead>
                <tr className="text-left text-lc-dim">
                  <th className="lc-display py-1 text-xs">{t('investments.holder')}</th>
                  {investment.tier >= 3 && (
                    <th className="lc-display py-1 text-xs">{t('ownership.class')}</th>
                  )}
                  {investment.tier === 4 && (
                    <th className="lc-display py-1 text-right text-xs">{t('ownership.shares')}</th>
                  )}
                  {investment.tier >= 3 && (
                    <>
                      <th className="lc-display py-1 text-right text-xs">{t('ownership.stake')}</th>
                      <th className="lc-display py-1 text-right text-xs">{t('ownership.votes')}</th>
                      <th className="lc-display py-1 text-right text-xs">
                        {t('investments.holder.asks')}
                      </th>
                    </>
                  )}
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {investment.holders.map((h) => (
                  <tr key={h.id} className="border-t border-lc-line">
                    <td className="py-1">
                      <span className="font-medium">{h.name}</span>{' '}
                      {h.type !== null && (
                        <span className="text-lc-dim">
                          {t(`ownership.type.${h.type}` as never)}
                        </span>
                      )}{' '}
                      {h.major && !h.mine && (
                        <span className="text-lc-dim">{t('investments.cap.major')}</span>
                      )}
                    </td>
                    {investment.tier >= 3 && (
                      <td className="py-1">
                        {h.class !== null && t(`ownership.class.${h.class}` as never)}
                      </td>
                    )}
                    {investment.tier === 4 && (
                      <td className="lc-num py-1 text-right">
                        {h.shares === null ? '' : h.shares.toLocaleString('en-AU')}
                      </td>
                    )}
                    {investment.tier >= 3 && (
                      <>
                        <td className="py-1 text-right">
                          {h.stake && <FogShare span={h.stake} knowledge={investment.knowledge} />}
                        </td>
                        <td className="py-1 text-right">
                          {h.votes && <FogShare span={h.votes} knowledge={investment.knowledge} />}
                        </td>
                        <td className="py-1 text-right">
                          {h.premium && (
                            <FogShare span={h.premium} knowledge={investment.knowledge} />
                          )}
                        </td>
                      </>
                    )}
                    <td className="py-1 text-right">
                      {h.mine ? (
                        <span className="text-lc-dim">{t('investments.mine')}</span>
                      ) : (
                        h.asking && (
                          <button
                            type="button"
                            className={quiet}
                            disabled={busy || h.asking.low > wealth.personalCash}
                            onClick={() => void buyStake(h.id)}
                          >
                            {t('investments.buy', { price: amountText(h.asking) })}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {mineStake > 0 && (
              <div className="space-y-1">
                <p className="text-lc-dim">{t('investments.sell.explain')}</p>
                <button
                  type="button"
                  className={quiet}
                  disabled={busy}
                  onClick={() => void sellStake(investment.garageId)}
                >
                  {t('investments.sell', { price: amountText(investment.mineWorth) })}
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
              {quote && quote.cost !== null && quote.votes !== null ? (
                <p className="lc-num">
                  {t('investments.takeover.estimate', {
                    premium: Number(premium) || 0,
                    votes: voteText(quote.votes.low, quote.votes.high),
                    cost: amountText(quote.cost),
                  })}
                </p>
              ) : (
                <p className="text-lc-dim">{t('investments.takeover.unknown')}</p>
              )}
              {quote && quote.outlook !== 'unknown' && (
                <p>
                  {t(`investments.takeover.board.${quote.board}` as never)}{' '}
                  {t(`investments.takeover.outlook.${quote.outlook}` as never)}
                </p>
              )}
              {!investment.takeoverOpen && (
                <p className="text-lc-dim">{t('investments.takeover.closed')}</p>
              )}
              {quote?.cost && quote.cost.low > garageCash && (
                <p className="text-lc-bad">{t('investments.takeover.afford')}</p>
              )}
              <button
                type="button"
                className={button}
                disabled={
                  busy ||
                  !investment.takeoverOpen ||
                  !quote ||
                  quote.outlook === 'fails' ||
                  (quote.cost !== null && quote.cost.low > garageCash)
                }
                onClick={() =>
                  void launchTakeover(investment.garageId, (Number(premium) || 0) / 100)
                }
              >
                {t('investments.takeover.button', { cost: amountText(quote?.cost ?? null) })}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
