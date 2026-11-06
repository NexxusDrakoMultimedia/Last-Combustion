// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatMoney, t } from '../../i18n';
import { dealerBuybackPrice } from '../../sim/economy';
import { useCareerStore } from '../../state/career.store';
import { Plate } from '../Plate';
import { button, quiet } from '../styles';

/** The dealers: new cars at the list price less any manufacturer deal, and selling a car for a share of its value. */
export function DealerSection({ locked }: { locked: boolean }) {
  const { dealer, cars, hub, status, buyNewCar, sellCar } = useCareerStore();
  const cash = hub?.player?.cash ?? 0;
  const busy = status === 'busy';
  const sellable = cars.filter((c) => c.inEntry === null);
  return (
    <div className="space-y-6 text-sm">
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('dealer.newTitle')}</h3>
        <p className="text-lc-dim">{t('dealer.newIntro')}</p>
        <ul className="space-y-1">
          {dealer.map((d) => (
            <li
              key={d.modelId}
              className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
            >
              <span>
                <span className="font-medium">{d.name}</span>{' '}
                <span className="text-lc-dim">
                  {t('dealer.maker', { maker: d.maker, tier: t(`dealer.tier.${d.tier}` as never) })}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {d.price < d.listPrice && (
                  <span className="lc-num text-xs text-lc-dim line-through">
                    {formatMoney(d.listPrice)}
                  </span>
                )}
                <span className="lc-num">{formatMoney(d.price)}</span>
                <button
                  type="button"
                  className={button}
                  disabled={locked || busy || d.price > cash}
                  onClick={() => void buyNewCar(d.modelId)}
                >
                  {t('dealer.buy')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('dealer.sellTitle')}</h3>
        <p className="text-lc-dim">{t('dealer.sellIntro')}</p>
        {sellable.length === 0 && <p className="text-lc-dim">{t('dealer.nothingToSell')}</p>}
        <ul className="space-y-1">
          {sellable.map((c) => (
            <li
              key={c.carId}
              className="flex flex-wrap items-center justify-between gap-2 border border-lc-line p-2"
            >
              <span>
                <Plate plate={c.plate} state={c.plateState} carId={c.carId} />{' '}
                <span className="font-medium">{c.modelName}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="lc-num">{formatMoney(dealerBuybackPrice(c.value))}</span>
                <button
                  type="button"
                  className={quiet}
                  disabled={locked || busy}
                  onClick={() => void sellCar(c.carId)}
                >
                  {t('dealer.sell')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
