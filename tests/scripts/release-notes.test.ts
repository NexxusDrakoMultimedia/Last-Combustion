// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const notes = (version: string): string =>
  execFileSync('node', ['scripts/release-notes.mjs', version], { encoding: 'utf8' });

describe('release notes', () => {
  it('print the section of a released version', () => {
    expect(notes('0.1.2')).toContain('foreign flag');
  });

  it('give a beta the notes under Unreleased, with a line saying it is a beta', () => {
    const text = notes('0.2.0-beta7');
    expect(text.startsWith('A beta of the 0.2.0 release')).toBe(true);
    expect(text).not.toContain('## [0.1.2]');
  });
});
