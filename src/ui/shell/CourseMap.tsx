// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { CourseMapData } from '../../db/coursemap';
import { t } from '../../i18n';
import { outlineOf, pointAtKm } from '../../sim/courses/map';

/** What an incident looks like on the map, by kind (the name is in the mark's title too). */
const KIND_CLASS: Record<string, string> = {
  crash: 'fill-red-500',
  spin: 'fill-amber-400',
  mistake: 'fill-yellow-300',
  wildlife: 'fill-emerald-400',
  mechanical_failure: 'fill-sky-400',
  contact: 'fill-fuchsia-400',
};

/** The same colours for the key's swatches (written out in full so the stylesheet generates them). */
const KIND_SWATCH: Record<string, string> = {
  crash: 'bg-red-500',
  spin: 'bg-amber-400',
  mistake: 'bg-yellow-300',
  wildlife: 'bg-emerald-400',
  mechanical_failure: 'bg-sky-400',
  contact: 'bg-fuchsia-400',
};

/** The line of text for a kind of incident; the key is built from data, so the compiler cannot see it. */
const kindName = (kind: string): string => t(`map.kind.${kind}` as never);

/** A course drawn from its saved outline, with its overtaking spots and where things went wrong. */
export function CourseMap({ map }: { map: CourseMapData }) {
  const outline = outlineOf(map.courseNumber);
  if (!outline) return <p className="text-lc-dim">{t('map.none')}</p>;
  const [minX, minY, width, height] = outline.viewBox;
  const start = pointAtKm(outline.points, 0);
  const counts = new Map<string, number>();
  for (const m of map.markers) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
  return (
    <div className="space-y-2">
      <svg
        viewBox={`${minX} ${minY} ${width} ${height}`}
        role="img"
        aria-label={t('map.aria', { name: map.name })}
        className="h-auto w-full max-w-xl border border-lc-line bg-lc-raised"
      >
        <path
          d={outline.path}
          fill="none"
          strokeWidth={5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-lc-dim"
        />
        <circle cx={start.x} cy={start.y} r={9} className="fill-lc-dim" />
        {map.sectors
          .filter((s) => s.overtakeSpot)
          .map((s) => {
            const p = pointAtKm(outline.points, s.startKm);
            return (
              <circle
                key={`o${s.startKm}`}
                data-overtake
                cx={p.x}
                cy={p.y}
                r={8}
                fill="none"
                strokeWidth={3}
                className="stroke-lc-dim"
              />
            );
          })}
        {map.markers.map((m, i) => {
          const p = pointAtKm(outline.points, m.km);
          return (
            <circle
              key={`${m.kind}-${m.km}-${i}`}
              data-marker
              cx={p.x}
              cy={p.y}
              r={7}
              className={KIND_CLASS[m.kind] ?? 'fill-lc-dim'}
            >
              <title>{kindName(m.kind)}</title>
            </circle>
          );
        })}
      </svg>
      {counts.size > 0 && (
        <ul data-legend className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {[...counts].map(([kind, count]) => (
            <li key={kind} className="flex items-center gap-1">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${KIND_SWATCH[kind] ?? 'bg-lc-dim'}`}
              />
              {t('map.legend', { kind: kindName(kind), count })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
