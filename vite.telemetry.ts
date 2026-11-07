// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

const KEYS = ['VITE_GTAG_ID', 'VITE_GA_GAME_KEY', 'VITE_GA_SECRET_KEY'] as const;

/**
 * Cloudflare Workers Builds gives a preview and the release site the same build variables, so the
 * telemetry keys would reach previews. This removes them from any Cloudflare build that is not of
 * `main`, so a preview collects nothing. Builds elsewhere (GitHub Pages, local, tests) are untouched.
 * Returns the names it removed.
 */
export function dropTelemetryKeysOffMain(env: NodeJS.ProcessEnv = process.env): string[] {
  const branch = env.WORKERS_CI_BRANCH;
  if (env.WORKERS_CI !== '1' || branch === 'main') return [];
  const removed: string[] = [];
  for (const key of KEYS) {
    if (env[key] !== undefined) {
      delete env[key];
      removed.push(key);
    }
  }
  return removed;
}
