// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatMoney, t } from '../i18n';
import { useCareerStore } from '../state/career.store';
import { button, panel } from './styles';

/** The player's cars, and the used market where more can be bought. */
export function Market() {
  const { cars, listings, hub, status, starter, buyListing, raceCar } = useCareerStore();
  const busy = status === 'busy' || starter !== undefined;
  const started = hub?.rounds.some((r) => r.status !== 'scheduled') ?? false;
  const cash = hub?.player?.cash ?? 0;
  if (!hub?.player) return null;

  return (
    <section aria-labelledby="cars-heading" className={panel}>
      <h2 id="cars-heading" className="text-xl font-semibold">
        {t('market.cars')}
      </h2>
      <ul className="space-y-1 text-sm">
        {cars.map((c) => (
          <li key={c.carId} className="flex flex-wrap items-center gap-2">
            <span>
              {t('market.car', {
                model: c.modelName,
                year: c.modelYear,
                km: c.roadKm,
                wear: c.wear,
                value: formatMoney(c.value),
              })}
            </span>
            {c.inEntry !== null ? (
              <span className="text-zinc-400">{t('market.racing', { number: c.inEntry })}</span>
            ) : (
              <button
                type="button"
                className={button}
                disabled={busy || started}
                onClick={() => void raceCar(c.carId)}
              >
                {t('market.use')}
              </button>
            )}
          </li>
        ))}
      </ul>
      <h2 id="market-heading" className="text-xl font-semibold">
        {t('market.heading')}
      </h2>
      <ul className="space-y-1 text-sm">
        {listings.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-2">
            <span>
              {t('market.listing', {
                model: l.modelName,
                year: l.modelYear,
                km: l.roadKm,
                wear: Math.round(l.wear * 10) / 10,
                price: formatMoney(l.price),
              })}
            </span>
            <button
              type="button"
              className={button}
              disabled={busy || l.price > cash}
              onClick={() => void buyListing(l.id)}
            >
              {t('market.buy')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
