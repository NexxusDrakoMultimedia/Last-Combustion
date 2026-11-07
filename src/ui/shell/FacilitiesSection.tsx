// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatMoney, t } from '../../i18n';
import { MAX_FACILITY_LEVEL, type FacilityKind } from '../../sim/facilities';
import { useCareerStore } from '../../state/career.store';
import { button } from '../styles';

const pct = (x: number): number => Math.round(x * 1000) / 10;

/** What a facility does, in words, from the effect it adds with each level. */
function describeEffect(kind: FacilityKind, effect: Record<string, number>): string {
  switch (kind) {
    case 'workshop_bays':
      return t('facility.effect.workshop_bays', { percent: pct(effect.crewCover ?? 0) });
    case 'data_room':
      return t('facility.effect.data_room', { percent: pct(effect.breakthrough ?? 0) });
    case 'driver_simulator':
      return t('facility.effect.driver_simulator', { percent: pct(effect.training ?? 0) });
    case 'parts_store':
      return t('facility.effect.parts_store', { percent: pct(effect.partPrice ?? 0) });
    case 'solar_array':
      return t('facility.effect.solar_array', {
        percent: pct(effect.electricity ?? 0),
        cover: pct(effect.outageCover ?? 0),
      });
    case 'water_tanks':
      return t('facility.effect.water_tanks', { percent: pct(effect.water ?? 0) });
    case 'transporter_fleet':
      return t('facility.effect.transporter_fleet', {
        percent: pct(effect.logistics ?? 0),
        late: pct(effect.lateDeliveries ?? 0),
      });
  }
}

/** The garage's premises: what is built, what each level does and costs, and the next level to buy. */
export function FacilitiesSection() {
  const { facilities, hub, status, buildFacility } = useCareerStore();
  const busy = status === 'busy';
  const cash = hub?.player?.cash ?? 0;
  const upkeep = facilities.reduce((sum, f) => sum + f.running, 0);
  return (
    <div className="space-y-4 text-sm">
      <p className="lc-num">{t('facilities.total', { amount: formatMoney(upkeep) })}</p>
      <ul className="space-y-2">
        {facilities.map((f) => {
          const needed = f.needs ? t(`facility.name.${f.needs}` as never) : '';
          return (
            <li key={f.kind} className="space-y-2 border border-lc-line p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="lc-display text-sm">{t(`facility.name.${f.kind}` as never)}</h3>
                <span className="lc-num text-lc-dim">
                  {f.level === 0
                    ? t('facilities.none')
                    : t('facilities.level', { level: f.level, max: MAX_FACILITY_LEVEL })}
                </span>
              </div>
              <p className="text-lc-dim">{describeEffect(f.kind, f.effect)}</p>
              {f.level > 0 && (
                <p className="lc-num text-lc-dim">
                  {t('facilities.upkeep', { amount: formatMoney(f.running) })}
                </p>
              )}
              {!f.needsMet && (
                <p className="text-lc-bad">{t('facilities.needs', { name: needed })}</p>
              )}
              {f.nextCost === null ? (
                <p className="text-lc-good">{t('facilities.maxed')}</p>
              ) : (
                <button
                  type="button"
                  className={button}
                  disabled={busy || !f.needsMet || f.nextCost > cash}
                  onClick={() => void buildFacility(f.kind)}
                >
                  {f.level === 0
                    ? t('facilities.build', { amount: formatMoney(f.nextCost) })
                    : t('facilities.upgrade', {
                        level: f.level + 1,
                        amount: formatMoney(f.nextCost),
                      })}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
