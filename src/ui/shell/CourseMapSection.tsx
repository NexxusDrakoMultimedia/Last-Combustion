// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import { t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';
import { CourseMap } from './CourseMap';

/** The map of a round's course, with the round to look at chosen from the season. */
export function CourseMapSection() {
  const { courseMap, mapRounds, loadCourseMap } = useCareerStore();
  useEffect(() => {
    loadCourseMap();
  }, [loadCourseMap]);
  return (
    <section className="space-y-2">
      <h3 className="lc-display text-sm text-lc-dim">{t('map.title')}</h3>
      <p className="text-lc-dim">{t('map.intro')}</p>
      {!courseMap ? (
        <p className="text-lc-dim">{t('map.none')}</p>
      ) : (
        <>
          <label className="flex flex-wrap items-center gap-2">
            <span>{t('map.round')}</span>
            <select
              className="border border-lc-line bg-lc-raised px-2 py-1"
              value={courseMap.round}
              onChange={(e) => loadCourseMap(Number(e.target.value))}
            >
              {mapRounds.map((n) => (
                <option key={n} value={n}>
                  {t('map.option', { round: n })}
                </option>
              ))}
            </select>
          </label>
          <p className="font-medium">
            {t('map.course', {
              name: courseMap.name,
              km: courseMap.lapKm,
              year: courseMap.year,
            })}
          </p>
          <CourseMap map={courseMap} />
          {courseMap.markers.length === 0 && <p className="text-lc-dim">{t('map.quiet')}</p>}
        </>
      )}
    </section>
  );
}
