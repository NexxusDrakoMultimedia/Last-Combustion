// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { NewsLine } from '../../src/db/news';
import { hasText, t } from '../../src/i18n';
import { JOURNALISTS } from '../../src/sim/press';
import { storylineData } from '../../src/sim/worldgen/data';
import { useCareerStore } from '../../src/state/career.store';
import { PressSection } from '../../src/ui/shell/PressSection';

afterEach(cleanup);

const journalist = JOURNALISTS[0]!;
const line = (over: Partial<NewsLine>): NewsLine => ({
  id: 1,
  kind: 'winner',
  detail: '',
  driver: 'Ayla Ward',
  other: null,
  journalist,
  round: 2,
  year: 2031,
  ...over,
});

const html = () => render(createElement(PressSection)).container.innerHTML;

describe('the news in the Press panel', () => {
  it('says so when there is no news', () => {
    useCareerStore.setState({ press: undefined, news: [] });
    expect(html()).toContain(t('news.none'));
  });

  it('shows each item with the drivers and the journalist who wrote it', () => {
    useCareerStore.setState({
      press: undefined,
      news: [
        line({ id: 3, kind: 'winner' }),
        line({ id: 2, kind: 'crash', detail: 'final', driver: 'Tom Reid' }),
        line({ id: 1, kind: 'rivalry', detail: 'close_finish', other: 'Tom Reid' }),
      ],
    });
    const out = html();
    expect(out).toContain('Ayla Ward');
    expect(out).toContain('Tom Reid');
    expect(out).toContain(journalist.name);
  });
});

describe('the text of the news', () => {
  it('has a line for every kind and detail the press can write', () => {
    const keys = [
      'news.winner',
      'news.crash.prelim',
      'news.crash.final',
      'news.rivalry.close_finish',
      'news.rivalry.title_fight',
    ];
    for (const [name, template] of Object.entries(storylineData.templates))
      for (const beat of template.beats) keys.push(`news.story.${name}.${beat.key}`);
    for (const key of keys) expect(hasText(key), key).toBe(true);
  });
});
