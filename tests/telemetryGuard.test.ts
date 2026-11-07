// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { dropTelemetryKeysOffMain } from '../vite.telemetry';

const keys = () => ({
  VITE_GTAG_ID: 'a',
  VITE_GA_GAME_KEY: 'b',
  VITE_GA_SECRET_KEY: 'c',
  VITE_BETTERSTACK_TOKEN: 'd',
  VITE_SENTRY_DSN: 'e',
});

describe('telemetry keys in Cloudflare builds', () => {
  it('are dropped from a preview', () => {
    const env = { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'feature/0.2.x', ...keys() };
    expect(dropTelemetryKeysOffMain(env)).toHaveLength(5);
    expect(env.VITE_GA_GAME_KEY).toBeUndefined();
    expect(env.VITE_BETTERSTACK_TOKEN).toBeUndefined();
    expect(env.VITE_SENTRY_DSN).toBeUndefined();
  });
  it('are kept on main', () => {
    const env = { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main', ...keys() };
    expect(dropTelemetryKeysOffMain(env)).toEqual([]);
    expect(env.VITE_GTAG_ID).toBe('a');
  });
  it('are kept in builds that are not Cloudflare', () => {
    const env = { ...keys() };
    expect(dropTelemetryKeysOffMain(env)).toEqual([]);
    expect(env.VITE_GA_SECRET_KEY).toBe('c');
  });
});
