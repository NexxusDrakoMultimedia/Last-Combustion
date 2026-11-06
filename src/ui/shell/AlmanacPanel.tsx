// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { RegistryLink } from '../RegistryLink';

/** The almanac: every finished season's champions and awards, and the record book. */
export function AlmanacPanel({ tab }: { tab: string }) {
  const book = useCareerStore((s) => s.recordBook);
  if (!book || book.seasons.length === 0)
    return <p className="text-sm text-lc-dim">{t('almanac.none')}</p>;

  if (tab === 'records')
    return (
      <dl className="space-y-1 text-sm">
        {book.records.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-baseline justify-between gap-2 border border-lc-line p-2"
          >
            <dt className="text-lc-dim">{t(`almanac.record.${r.id}` as never)}</dt>
            <dd>
              <span className="font-medium">{r.holder}</span>{' '}
              <span className="lc-num">
                {r.year === undefined
                  ? t('almanac.recordValue', { value: r.value })
                  : t('almanac.recordValueYear', { value: r.value, year: r.year })}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    );

  return (
    <div className="space-y-4 text-sm">
      {book.seasons.map((s) => (
        <section key={s.year} className="space-y-2 border border-lc-line p-3">
          <h3 className="lc-display text-sm">{t('almanac.season', { year: s.year })}</h3>
          <p>
            {t('almanac.championsLead')}{' '}
            <RegistryLink to={{ kind: 'driver', id: s.championDriverId }}>
              {s.championDriver}
            </RegistryLink>{' '}
            {t('almanac.championsPoints', { points: s.championPoints })}{' '}
            {t('almanac.championsGarage')}{' '}
            <RegistryLink to={{ kind: 'garage', id: s.championGarageId }}>
              {s.championGarage}
            </RegistryLink>
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {s.awards.map((a) => (
              <li key={a.award} className="border border-lc-line p-2">
                <span className="lc-display block text-xs text-lc-dim">
                  {t(`award.${a.award}` as never)}
                </span>
                <span className="font-medium">
                  <RegistryLink to={{ kind: a.subjectType, id: a.subjectId }}>
                    {a.name}
                  </RegistryLink>
                </span>{' '}
                <span className="lc-num text-lc-dim">
                  {t(`award.${a.award}.value` as never, { value: a.value })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
