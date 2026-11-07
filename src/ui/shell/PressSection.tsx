// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import { t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** The press: the journalists and how each sees the garage, and the headlines they have written. */
export function PressSection() {
  const { press, hub, loadPress } = useCareerStore();
  useEffect(() => {
    loadPress();
  }, [loadPress]);
  const garage = hub?.player?.garageName ?? '';
  return (
    <div className="space-y-6 text-sm">
      <p className="text-lc-dim">{t('press.intro')}</p>
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('press.headlines')}</h3>
        {!press || press.headlines.length === 0 ? (
          <p className="text-lc-dim">{t('press.none')}</p>
        ) : (
          <ul className="space-y-2">
            {press.headlines.map((h) => (
              <li key={h.id} className="border-t border-lc-line pt-2">
                <p className="font-medium">
                  {t(`press.headline.${h.kind}.${h.tone}` as never, {
                    driver: h.driver,
                    garage,
                    position: h.position,
                  })}
                </p>
                <p className="text-xs text-lc-dim">
                  {t('press.byline', {
                    round: h.round,
                    year: h.year,
                    name: h.journalist.name,
                    outlet: h.journalist.outlet,
                    fans: signed(h.fans),
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {press && (
        <section className="space-y-2">
          <h3 className="lc-display text-sm text-lc-dim">{t('press.journalists')}</h3>
          <ul className="space-y-1">
            {press.journalists.map((j) => (
              <li key={j.id} className="border-t border-lc-line py-1">
                <span className="font-medium">
                  {t('press.journalist', { name: j.name, outlet: j.outlet })}
                </span>{' '}
                <span className="text-lc-dim">
                  {t('press.view', {
                    taste: t(`press.taste.${j.taste}` as never),
                    tone: t(`press.tone.${j.tone}` as never),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
