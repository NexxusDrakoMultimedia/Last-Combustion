// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect, useState } from 'react';
import { formatDate, t } from '../../i18n';
import { MANNERS, type Manner } from '../../sim/social';
import { useCareerStore } from '../../state/career.store';
import { button, field } from '../styles';

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** The social occasions: spend a few conversations on the people the garage knows, or meet someone new. */
export function SocialSection() {
  const { social, status, loadSocial, converse } = useCareerStore();
  const [who, setWho] = useState('');
  const [manner, setManner] = useState<Manner>('warm');
  useEffect(() => {
    loadSocial();
  }, [loadSocial]);
  if (!social) return <p className="text-sm text-lc-dim">{t('social.closed')}</p>;
  const busy = status === 'busy';
  const target = who === 'new' ? null : who === '' ? undefined : who.split(':');
  return (
    <div className="space-y-6 text-sm">
      <p className="text-lc-dim">{t('social.intro')}</p>
      {social.occasion === null ? (
        <p className="text-lc-dim">
          {social.next
            ? t('social.next', {
                occasion: t(`social.occasion.${social.next.id}` as never),
                date: formatDate(social.next.date),
              })
            : t('social.closed')}
        </p>
      ) : (
        <section className="space-y-3">
          <h3 className="lc-display text-sm text-lc-dim">
            {t('social.open', {
              occasion: t(`social.occasion.${social.occasion}` as never),
              left: social.left,
              total: social.total,
            })}
            {social.until && ` ${t('social.until', { date: formatDate(social.until) })}`}
          </h3>
          <label className="block space-y-1" htmlFor="social-who">
            {t('social.who')}
            <select
              id="social-who"
              className={field}
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              <option value="">{t('social.choose')}</option>
              {social.contacts.map((c) => (
                <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>
                  {c.name}
                </option>
              ))}
              {social.strangers > 0 && (
                <option value="new">{t('social.someoneNew', { count: social.strangers })}</option>
              )}
            </select>
          </label>
          <label className="block space-y-1" htmlFor="social-manner">
            {t('social.manner')}
            <select
              id="social-manner"
              className={field}
              value={manner}
              onChange={(e) => setManner(e.target.value as Manner)}
            >
              {MANNERS.map((m) => (
                <option key={m} value={m}>
                  {t(`social.manner.${m}` as never)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={button}
            disabled={busy || social.left === 0 || target === undefined}
            onClick={() =>
              void converse(
                target === null || target === undefined
                  ? null
                  : { type: target[0] as never, id: Number(target[1]) },
                manner,
              )
            }
          >
            {t('social.talk')}
          </button>
        </section>
      )}
      <section className="space-y-2">
        <h3 className="lc-display text-sm text-lc-dim">{t('social.history')}</h3>
        {social.history.length === 0 ? (
          <p className="text-lc-dim">{t('social.nothing')}</p>
        ) : (
          <ul className="space-y-1">
            {social.history.map((h) => (
              <li key={h.id} className="border-t border-lc-line py-1">
                {t(h.met ? 'social.line.met' : 'social.line.known', {
                  occasion: t(`social.occasion.${h.occasion}` as never),
                  manner: t(`social.manner.${h.manner}` as never).toLowerCase(),
                  name: h.party.name,
                  delta: signed(h.delta),
                })}{' '}
                {h.trouble && <span className="text-lc-bad">{t('social.trouble')}</span>}{' '}
                {h.introduced && <span className="text-lc-dim">{t('social.introduced')}</span>}{' '}
                {h.auto && <span className="text-lc-dim">{t('social.auto')}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
