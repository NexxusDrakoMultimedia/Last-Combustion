// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { describe, expect, it } from 'vitest';
import { hasText } from '../../src/i18n';
import { siteLinks } from '../../src/sim/worldgen/data';

describe('the links on the About screen', () => {
  it('are the project owner’s website and accounts, all secure links, each listed once', () => {
    expect(siteLinks.links.map((l) => l.id)).toEqual([
      'website',
      'kofi',
      'bluesky',
      'discord',
      'github',
    ]);
    const hosts = new Map(siteLinks.links.map((l) => [l.id, new URL(l.url)]));
    for (const url of hosts.values()) expect(url.protocol).toBe('https:');
    expect(hosts.get('website')!.hostname).toBe('nexxusdrako.au');
    expect(hosts.get('kofi')!.href).toBe('https://ko-fi.com/nexxusdrako');
    expect(hosts.get('bluesky')!.href).toBe('https://bsky.app/profile/nexxusdrako.au');
    expect(hosts.get('discord')!.hostname).toBe('discord.gg');
    expect(hosts.get('github')!.pathname.toLowerCase()).toBe('/nexxus-drako');
    expect(new Set(siteLinks.links.map((l) => l.url)).size).toBe(siteLinks.links.length);
  });

  it('point the source link at the repository and the web build at the game’s own address', () => {
    expect(new URL(siteLinks.repository).pathname).toBe('/NexxusDrakoMultimedia/Last-Combustion');
    expect(new URL(siteLinks.webBuild).hostname).toBe('lc.nexxusdrako.au');
  });

  it('each have a name and a note to show', () => {
    for (const l of siteLinks.links) {
      expect(hasText(`about.link.${l.id}`)).toBe(true);
      expect(hasText(`about.link.${l.id}.note`)).toBe(true);
    }
  });
});
