// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { formatDate, formatLapTime, formatMoney, t } from '../i18n';
import { useCareerStore } from '../state/career.store';
import { Market } from './Market';
import { StarterChoice } from './StarterChoice';
import { button, panel } from './styles';

/** The season hub: the garage, the calendar, the running buttons, results and the table. */
export function Hub() {
  const s = useCareerStore();
  const {
    hub,
    starter,
    status,
    nextRound,
    nextFinal,
    prelims,
    final,
    seasonEnd,
    rollover,
    notice,
  } = s;
  const busy = status === 'busy' || starter !== undefined;
  if (!hub) return null;
  const allDone = hub.rounds.every((r) => r.status === 'complete');
  const ended = hub.seasonStatus === 'complete';

  return (
    <div className="space-y-4">
      <section aria-labelledby="garage-heading" className={panel}>
        <h2 id="garage-heading" className="text-xl font-semibold">
          {hub.player ? hub.player.garageName : t('hub.noGarage')}
        </h2>
        {hub.player && (
          <>
            <p className="text-sm text-zinc-300">
              {t('hub.garageLine', {
                owner: hub.player.ownerName,
                cash: formatMoney(hub.player.cash),
                prestige: hub.player.prestige,
                fans: hub.player.fans,
              })}
            </p>
            <ul className="text-sm text-zinc-300">
              {hub.player.entries.map((e) => (
                <li key={e.raceNumber}>
                  {t('hub.entry', { number: e.raceNumber, driver: e.driver, car: e.car })}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <StarterChoice />

      <Market />

      <section aria-labelledby="season-heading" className={panel}>
        <h2 id="season-heading" className="text-xl font-semibold">
          {t('hub.season', { year: hub.year })}
        </h2>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t('hub.calendar')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('hub.round')}</th>
              <th scope="col">{t('hub.course')}</th>
              <th scope="col">{t('hub.date')}</th>
              <th scope="col">{t('hub.status')}</th>
            </tr>
          </thead>
          <tbody>
            {hub.rounds.map((r) => (
              <tr key={r.number}>
                <td>{r.number}</td>
                <td>{r.course}</td>
                <td>{formatDate(r.finalDate)}</td>
                <td>{t(`hub.status.${r.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={busy || nextRound === null}
            onClick={() => void s.runNextPrelims()}
          >
            {t('hub.runPrelims')}
          </button>
          <button
            type="button"
            className={button}
            disabled={busy || nextFinal === null}
            onClick={() => void s.runNextFinal()}
          >
            {t('hub.runFinal')}
          </button>
          <button
            type="button"
            className={button}
            disabled={busy || !allDone || ended}
            onClick={() => void s.finishSeason()}
          >
            {t('hub.endSeason')}
          </button>
          <button
            type="button"
            className={button}
            disabled={busy || !ended}
            onClick={() => void s.newSeason()}
          >
            {t('hub.nextSeason')}
          </button>
        </div>
        <ul className="space-y-1 text-sm text-zinc-300" aria-live="polite">
          {prelims && (
            <li>
              {t('hub.prelims', {
                round: prelims.roundNumber,
                finishers: prelims.finishers,
                qualifiers: prelims.qualifiers,
                pole: prelims.top[0]
                  ? t('hub.pole', {
                      number: prelims.top[0].raceNumber,
                      driver: prelims.top[0].driver,
                      time: formatLapTime(prelims.top[0].timeMs),
                    })
                  : '',
              })}
            </li>
          )}
          {final && (
            <li>
              {t('hub.final', {
                round: final.roundNumber,
                finishers: final.finishers,
                winner: final.podium[0]
                  ? t('hub.winner', {
                      number: final.podium[0].raceNumber,
                      driver: final.podium[0].driver,
                    })
                  : '',
              })}
            </li>
          )}
          {seasonEnd && (
            <li>
              {t('hub.seasonEnd', {
                year: seasonEnd.year,
                prize: formatMoney(seasonEnd.prizePaid),
              })}
            </li>
          )}
          {hub.championName && <li>{t('hub.champion', { name: hub.championName })}</li>}
          {rollover && (
            <li>
              {t('hub.rollover', {
                year: rollover.year,
                retired: rollover.retired,
                rookies: rollover.rookies,
              })}
            </li>
          )}
          {notice && <li>{t(notice.key, notice.values)}</li>}
        </ul>
      </section>

      <section aria-labelledby="table-heading" className={panel}>
        <h2 id="table-heading" className="text-xl font-semibold">
          {t('hub.table')}
        </h2>
        {hub.standings.length === 0 ? (
          <p className="text-sm text-zinc-400">{t('hub.tableEmpty')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t('hub.table')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('hub.rank')}</th>
                <th scope="col">{t('hub.driver')}</th>
                <th scope="col">{t('hub.points')}</th>
                <th scope="col">{t('hub.wins')}</th>
              </tr>
            </thead>
            <tbody>
              {hub.standings.map((d) => (
                <tr key={d.rank}>
                  <td>{d.rank}</td>
                  <td>{t('hub.driverCell', { number: d.raceNumber, driver: d.driver })}</td>
                  <td>{d.points}</td>
                  <td>{d.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => void s.saveSlot1()}>
          {t('hub.save')}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy || s.slotsInUse === 0}
          onClick={() => void s.loadSlot1()}
        >
          {t('hub.load')}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() => void s.exportFile()}
        >
          {t('hub.export')}
        </button>
      </div>
    </div>
  );
}
