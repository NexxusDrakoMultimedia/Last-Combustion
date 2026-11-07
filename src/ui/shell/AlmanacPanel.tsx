// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import type { BoardRow } from '../../db/records';
import { Flag } from '../Flag';
import { Plate } from '../Plate';
import { RegistryLink, YearsActive } from '../RegistryLink';

const recordValue = (r: { value: number; year?: number }) =>
  r.year === undefined
    ? t('almanac.recordValue', { value: r.value })
    : t('almanac.recordValueYear', { value: r.value, year: r.year });

/** Who or what is on a leaderboard row: a driver, a garage, a car (by plate) or a nation (by flag). */
function Subject({ row }: { row: BoardRow }) {
  if (row.subjectType === 'nation')
    return (
      <span className="inline-flex items-center gap-1">
        {row.flag && <Flag code={row.flag} />}
        {row.name}
      </span>
    );
  if (row.subjectType === 'car')
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Plate plate={row.plate ?? ''} state={row.plateState ?? ''} carId={row.subjectId} />
        {row.name}
      </span>
    );
  return (
    <>
      <RegistryLink to={{ kind: row.subjectType, id: row.subjectId }}>{row.name}</RegistryLink>{' '}
      <YearsActive kind={row.subjectType} id={row.subjectId} />
    </>
  );
}

/** The almanac: every finished season's champions and awards, and the record book. */
export function AlmanacPanel({ tab }: { tab: string }) {
  const book = useCareerStore((s) => s.recordBook);
  if (!book || book.seasons.length === 0)
    return <p className="text-sm text-lc-dim">{t('almanac.none')}</p>;

  if (tab === 'records')
    return (
      <div className="space-y-2 text-sm">
        {book.records.map((r) => (
          <details key={r.id} className="border border-lc-line">
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 p-2 focus-visible:outline-2 focus-visible:outline-lc-accent-ink">
              <span className="text-lc-dim">{t(`almanac.record.${r.id}` as never)}</span>
              <span>
                <span className="font-medium">{r.holder}</span>{' '}
                <span className="lc-num">{recordValue(r)}</span>
              </span>
            </summary>
            <div className="space-y-1 border-t border-lc-line p-2">
              <ol className="space-y-1">
                {r.board.map((row, i) => (
                  <li
                    key={`${row.subjectType}:${row.subjectId}:${row.flag ?? ''}`}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    <span>
                      <span className="lc-num inline-block w-8 text-lc-dim">{i + 1}</span>
                      <Subject row={row} />
                    </span>
                    <span className="lc-num">{recordValue(row)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        ))}
      </div>
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
