// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import pennant from '../../assets/flags/attn.svg';
import type { AttentionMark } from '../db/registry';
import { t } from '../i18n';

/** The ATTN pennant: the series' computer flagged this run for pace well beyond what the car should manage. */
export function AttnFlag({ title = t('attention.label') }: { title?: string }) {
  return (
    <img
      src={pennant}
      alt={title}
      title={title}
      className="inline-block h-5 w-auto shrink-0 align-middle"
    />
  );
}

/** A driver's or a garage's attention flags: how many, and a pennant with its round for each. */
export function AttentionList({ marks }: { marks: AttentionMark[] }) {
  if (marks.length === 0) return <p className="text-lc-dim">{t('attention.none')}</p>;
  return (
    <div className="space-y-1">
      <p>{t('attention.count', { count: marks.length })}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-lc-dim">
        {marks.map((m, i) => {
          const where = t('attention.where', {
            year: m.year,
            round: m.round,
            course: m.course,
            session: t(`attention.session.${m.scope}` as never),
          });
          return (
            <li key={i} className="inline-flex items-center gap-1">
              <AttnFlag title={where} />
              <span>{where}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
