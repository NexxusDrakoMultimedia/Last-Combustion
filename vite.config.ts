// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { dropTelemetryKeysOffMain } from './vite.telemetry.ts';

dropTelemetryKeysOffMain();

export default defineConfig({
  base: process.env.BASE_URL ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Many tests play a whole season, which a slow runner can stretch well past the default 5 seconds.
    testTimeout: 30_000,
    coverage: { provider: 'v8', include: ['src/sim/**', 'src/db/**', 'src/i18n/**'] },
  },
});
