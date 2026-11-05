// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { t } from '../i18n';
import { plateStyles, type PlateState } from '../sim/plates';

/**
 * A car's Australian licence plate, in the colours of the state or territory that issued it, with
 * the state's short name on it so the plate says where the car is registered.
 */
export function Plate({ plate, state }: { plate: string; state: string }) {
  const style = plateStyles[state as PlateState];
  return (
    <span
      className="inline-flex flex-col items-center rounded-sm border px-1.5 py-0.5 align-middle leading-tight"
      style={
        style
          ? { color: style.text, backgroundColor: style.background, borderColor: style.text }
          : undefined
      }
      title={style ? `${style.name}: ${style.slogan}` : undefined}
      aria-label={t('plate.label', { plate, state: style ? style.name : state })}
    >
      <span aria-hidden="true" className="text-[0.55rem] font-semibold tracking-widest">
        {state}
      </span>
      <span aria-hidden="true" className="lc-num text-xs font-bold tracking-wider">
        {plate}
      </span>
    </span>
  );
}
