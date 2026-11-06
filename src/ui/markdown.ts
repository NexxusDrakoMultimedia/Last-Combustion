// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia

/** A piece of text inside a line: plain, bold, italic, code or a link. */
export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; url: string };

/** A block of a document: the small part of Markdown that CREDITS.md and CHANGELOG.md use. */
export type Block =
  | { kind: 'heading'; level: number; text: Inline[] }
  | { kind: 'paragraph'; text: Inline[] }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] };

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/** Splits a line into text, bold, italic, code and links. Anything it does not recognise stays as plain text. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  const pattern =
    /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(?<![\w*])[*_]([^*_\n]+)[*_](?![\w*])/g;
  let last = 0;
  for (const m of source.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: source.slice(last, at) });
    if (m[1] !== undefined) {
      // A link to a page in the repository, or anything unsafe, shows its text without the link.
      out.push(
        SAFE_URL.test(m[2]!)
          ? { kind: 'link', text: m[1], url: m[2]! }
          : { kind: 'text', text: m[1] },
      );
    } else if (m[3] !== undefined) out.push({ kind: 'strong', text: m[3] });
    else if (m[4] !== undefined) out.push({ kind: 'code', text: m[4] });
    else out.push({ kind: 'em', text: m[5]! });
    last = at + m[0].length;
  }
  if (last < source.length) out.push({ kind: 'text', text: source.slice(last) });
  return out;
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const isSeparator = (line: string): boolean =>
  /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line.trim());

/**
 * Removes HTML comments by scanning for them, repeating until none are left (removing one can join
 * the pieces around it into another). A comment that never closes hides the rest of its line only.
 */
function stripComments(source: string): string {
  const OPEN = '<!--';
  const CLOSE = '-->';
  let text = source;
  for (;;) {
    const start = text.indexOf(OPEN);
    if (start === -1) return text;
    const close = text.indexOf(CLOSE, start + OPEN.length);
    if (close !== -1) {
      text = text.slice(0, start) + text.slice(close + CLOSE.length);
      continue;
    }
    const lineEnd = text.indexOf('\n', start);
    text = lineEnd === -1 ? text.slice(0, start) : text.slice(0, start) + text.slice(lineEnd);
  }
}

/** Reads headings, paragraphs, bullet lists and tables from Markdown. Comments and anything else are skipped. */
export function parseMarkdown(source: string): Block[] {
  const lines = stripComments(source).split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length,
        text: parseInline(heading[2]!.trim()),
      });
      i++;
      continue;
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && isSeparator(lines[i + 1]!)) {
      const head = cells(line).map(parseInline);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        rows.push(cells(lines[i]!).map(parseInline));
        i++;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim() !== '') {
        const item = /^\s*[-*]\s+(.*)$/.exec(lines[i]!);
        if (item) items.push(item[1]!.trim());
        else if (items.length > 0 && /^\s+\S/.test(lines[i]!))
          items[items.length - 1] += ` ${lines[i]!.trim()}`;
        else break;
        i++;
      }
      blocks.push({ kind: 'list', items: items.map(parseInline) });
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]!) &&
      !/^\s*[-*]\s+/.test(lines[i]!) &&
      !lines[i]!.trim().startsWith('|')
    ) {
      paragraph.push(lines[i]!.trim());
      i++;
    }
    if (paragraph.length > 0)
      blocks.push({ kind: 'paragraph', text: parseInline(paragraph.join(' ')) });
    else i++;
  }
  return blocks;
}
