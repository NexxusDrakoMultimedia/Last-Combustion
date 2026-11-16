// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import type { LiveMap as LiveMapData } from '../../db/racewatch';
import { t } from '../../i18n';
import { outlineOf, pointAtKm } from '../../sim/courses/map';
import { KIND_CLASS, kindName } from './CourseMap';

/**
 * The course with the cars of a final on it: a dot for each running car (the player's own bigger and
 * labelled), and a mark where something went wrong on the lap under way, with the drone stops. The
 * positions come from the gaps in the timing tower.
 */
export function LiveMap({ map }: { map: LiveMapData }) {
  const outline = outlineOf(map.courseNumber);
  if (!outline) return null;
  const [minX, minY, width, height] = outline.viewBox;
  const mine = map.cars.filter((c) => c.mine);
  const others = map.cars.filter((c) => !c.mine);
  const kinds = [...new Set(map.marks.map((m) => m.type))];
  return (
    <div className="space-y-1">
      <svg
        viewBox={`${minX} ${minY} ${width} ${height}`}
        role="img"
        aria-label={t('race.map.aria')}
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
        {map.marks.map((m, i) => {
          const p = pointAtKm(outline.points, m.km);
          return (
            <circle
              key={`${m.type}-${m.km}-${i}`}
              data-mark={m.type}
              cx={p.x}
              cy={p.y}
              r={8}
              className={KIND_CLASS[m.type] ?? 'fill-lc-dim'}
            >
              <title>{t('race.map.mark', { kind: kindName(m.type), number: m.raceNumber })}</title>
            </circle>
          );
        })}
        {others.map((c) => {
          const p = pointAtKm(outline.points, c.km);
          return (
            <circle key={c.entryId} data-car cx={p.x} cy={p.y} r={5} className="fill-lc-text">
              <title>{t('race.map.car', { number: c.raceNumber })}</title>
            </circle>
          );
        })}
        {mine.map((c) => {
          const p = pointAtKm(outline.points, c.km);
          return (
            <g key={c.entryId} data-car data-mine>
              <circle cx={p.x} cy={p.y} r={9} className="fill-lc-accent" />
              <text
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                className="fill-lc-on-accent font-semibold"
              >
                {c.raceNumber}
              </text>
            </g>
          );
        })}
      </svg>
      {kinds.length > 0 && (
        <ul className="flex flex-wrap gap-3 text-xs text-lc-dim">
          {kinds.map((k) => (
            <li key={k}>{kindName(k)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
