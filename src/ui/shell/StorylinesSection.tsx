// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { useEffect } from 'react';
import { t } from '../../i18n';
import { useCareerStore } from '../../state/career.store';

/** A line of story text: the keys come from the template data, so they are not known to the compiler. */
const text = (key: string, values?: Record<string, string | number>): string =>
  t(key as never, values as never);

/** The live storylines of the player's drivers, and the event cards that wait for an answer. */
export function StorylinesSection() {
  const { story, loadStory, answerStoryCard } = useCareerStore();
  useEffect(() => {
    loadStory();
  }, [loadStory]);
  const empty = story.cards.length === 0 && story.stories.length === 0;
  return (
    <section className="space-y-2 text-sm">
      <h3 className="lc-display text-sm text-lc-dim">{t('story.title')}</h3>
      <p className="text-lc-dim">{t('story.intro')}</p>
      {empty && <p className="text-lc-dim">{t('story.none')}</p>}
      {story.cards.map((card) => (
        <div key={card.id} className="space-y-2 border border-lc-line bg-lc-raised p-2">
          <p className="font-medium">
            {text(`story.${card.template}.${card.beat}.title`, {
              driver: card.driverName,
              rival: card.rivalName,
            })}
          </p>
          <p className="text-lc-dim">
            {text(`story.${card.template}.${card.beat}.body`, {
              driver: card.driverName,
              rival: card.rivalName,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {card.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="border border-lc-line px-2 py-1 hover:bg-lc-line"
                onClick={() => void answerStoryCard(card.id, choice)}
              >
                {text(`story.${card.template}.${card.beat}.${choice}`)}
              </button>
            ))}
          </div>
        </div>
      ))}
      {story.stories.length > 0 && (
        <ul className="space-y-1">
          {story.stories.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t('story.line', {
                  name: text(`story.${s.template}.name`),
                  driver: s.driverName,
                  rival: s.rivalName,
                })}
              </span>
              <span className="text-xs text-lc-dim">
                {t('story.progress', { step: s.step, beats: s.beats })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
