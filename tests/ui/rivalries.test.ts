// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from '../../src/i18n';
import { useCareerStore } from '../../src/state/career.store';
import { RivalriesSection } from '../../src/ui/shell/RivalriesSection';

afterEach(cleanup);

const html = () => render(createElement(RivalriesSection)).container.innerHTML;

describe('the rivalries section', () => {
  it('says so when there are no rivalries', () => {
    useCareerStore.setState({ rivalries: [] });
    expect(html()).toContain(t('rivalry.none'));
  });

  it('shows each rival, the level and the meetings', () => {
    useCareerStore.setState({
      rivalries: [
        {
          driverId: 1,
          driverName: 'Ayla Ward',
          rivalId: 2,
          rivalName: 'Tom Reid',
          level: 'rivalry',
          heat: 72.5,
          startedYear: 2031,
          meetings: [
            { round: 2, year: 2031, kind: 'close_finish' },
            { round: 3, year: 2031, kind: 'title_fight' },
          ],
        },
      ],
    });
    const out = html();
    expect(out).toContain('Ayla Ward');
    expect(out).toContain('Tom Reid');
    expect(out).toContain(t('rivalry.level.rivalry'));
    expect(out).toContain(t('rivalry.meeting.close_finish', { round: 2, year: 2031, seconds: 3 }));
    expect(out).toContain(t('rivalry.meeting.title_fight', { round: 3, year: 2031 }));
  });
});
