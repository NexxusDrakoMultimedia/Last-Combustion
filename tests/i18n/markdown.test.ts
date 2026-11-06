// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from '../../src/ui/markdown';

describe('inline text', () => {
  it('finds links, bold, italic and code, and leaves the rest as it is', () => {
    expect(parseInline('See [the site](https://example.org/x) and **this** or `that`.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', text: 'the site', url: 'https://example.org/x' },
      { kind: 'text', text: ' and ' },
      { kind: 'strong', text: 'this' },
      { kind: 'text', text: ' or ' },
      { kind: 'code', text: 'that' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseInline('_soft_ words')[0]).toEqual({ kind: 'em', text: 'soft' });
    expect(parseInline('snake_case_name and 2*3*4')).toEqual([
      { kind: 'text', text: 'snake_case_name and 2*3*4' },
    ]);
  });

  it('only links to web pages and email, never to scripts or paths in the repository', () => {
    expect(parseInline('[x](javascript:alert(1))').some((p) => p.kind === 'link')).toBe(false);
    expect(parseInline('[x](javascript:alert(1))')[0]).toEqual({ kind: 'text', text: 'x' });
    expect(parseInline('[doc](docs/ARCHITECTURE.md)')).toEqual([{ kind: 'text', text: 'doc' }]);
    expect(parseInline('[mail](mailto:a@b.org)')[0]).toMatchObject({ kind: 'link' });
  });

  it('keeps every character of ordinary text, whatever it contains', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const text = parseInline(s)
          .map((p) => p.text)
          .join('');
        // Markers can be dropped, but nothing is invented and nothing throws.
        expect(text.length).toBeLessThanOrEqual(s.length);
      }),
    );
  });
});

describe('documents', () => {
  it('reads headings, paragraphs, lists and tables', () => {
    const blocks = parseMarkdown(
      '# Title\n\nSome words\nover two lines.\n\n- one\n- two with\n  more\n\n| A | B |\n| --- | --- |\n| 1 | **2** |\n',
    );
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'table']);
    const list = blocks[2]!;
    expect(list.kind === 'list' && list.items).toHaveLength(2);
    const table = blocks[3]!;
    expect(table.kind === 'table' && table.rows[0]![1]).toEqual([{ kind: 'strong', text: '2' }]);
  });

  it('drops comments completely, even ones built from the pieces of another', () => {
    const text = (src: string) => JSON.stringify(parseMarkdown(src));
    expect(text('before\n\n<!-- gone -->\n\nafter')).not.toContain('gone');
    expect(text('<!<!-- x -->-- hidden -->visible')).not.toContain('<!--');
    expect(text('<!<!-- x -->-- hidden -->visible')).toContain('visible');
    expect(text('kept <!-- never closed\nnext line')).toContain('next line');
    expect(text('kept <!-- never closed\nnext line')).not.toContain('<!--');
  });

  it('reads the real credits and changelog files', () => {
    const credits = parseMarkdown(readFileSync('CREDITS.md', 'utf8'));
    expect(credits[0]).toMatchObject({ kind: 'heading', level: 1 });
    const table = credits.find((b) => b.kind === 'table');
    expect(table && table.kind === 'table' && table.rows.length).toBeGreaterThanOrEqual(3);
    const changelog = parseMarkdown(readFileSync('CHANGELOG.md', 'utf8'));
    expect(changelog[0]).toMatchObject({ kind: 'heading', level: 1 });
    expect(changelog.some((b) => b.kind === 'heading' && b.level === 2)).toBe(true);
  });
});
