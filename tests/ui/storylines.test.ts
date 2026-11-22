// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '../../src/i18n';
import { useCareerStore } from '../../src/state/career.store';
import { StorylinesSection } from '../../src/ui/shell/StorylinesSection';

afterEach(cleanup);

const view = () => render(createElement(StorylinesSection));

describe('the storylines section', () => {
  it('says so when nothing is going on', () => {
    useCareerStore.setState({ story: { cards: [], stories: [] } });
    expect(view().container.innerHTML).toContain(t('story.none'));
  });

  it('shows the live storylines with how far along they are', () => {
    useCareerStore.setState({
      story: {
        cards: [],
        stories: [
          {
            id: 1,
            template: 'rivalry_feud',
            driverName: 'Ayla Ward',
            rivalName: 'Tom Reid',
            step: 1,
            beats: 3,
          },
        ],
      },
    });
    const out = view().container.innerHTML;
    expect(out).toContain('Ayla Ward');
    expect(out).toContain('Tom Reid');
    expect(out).toContain(t('story.rivalry_feud.name'));
  });

  it('shows a pending card with a button for each choice, and answers it', () => {
    const answer = vi.fn(() => Promise.resolve());
    useCareerStore.setState({
      answerStoryCard: answer,
      story: {
        stories: [],
        cards: [
          {
            id: 7,
            storylineId: 1,
            template: 'rivalry_feud',
            beat: 'build_up',
            driverId: 1,
            driverName: 'Ayla Ward',
            rivalId: 2,
            rivalName: 'Tom Reid',
            choices: ['fuel', 'high_road'],
          },
        ],
      },
    });
    const { getByText } = view();
    expect(getByText(t('story.rivalry_feud.build_up.fuel'))).toBeTruthy();
    fireEvent.click(getByText(t('story.rivalry_feud.build_up.high_road')));
    expect(answer).toHaveBeenCalledWith(7, 'high_road');
  });
});
