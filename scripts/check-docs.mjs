// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
// Checks the facts in the Markdown documents that a machine can check: relative links and their
// anchors, repository paths in `code spans`, and `pnpm` commands. Run with `pnpm docs:check`.
//
// A path in `code` that does not exist yet must be listed in PLANNED below, which is how the
// documents tell the reader "this is designed but not built": the list is the single place to
// see everything still to come, and an entry goes when the file is created.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/** Paths the design describes but the repository does not have yet. */
const PLANNED = new Set([
  'assets/brand',
  'data/facilities.json',
  'data/people.json',
  'data/ledger.json',
  'data/themes.json',
  'docs/PRESS.md',
  'docs/modding',
  'data/traits.json',
  'data/equity.json',
  'src/workers',
  'public',
]);

const PATH_ROOTS = [
  'src',
  'data',
  'tests',
  'e2e',
  'docs',
  'tools',
  'scripts',
  'locales',
  'assets',
  'public',
  '.github',
];
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const PNPM_BUILTINS = new Set(['install', 'add', 'remove', 'exec', 'dlx', 'run', 'update', 'up']);

const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f !== '' && !f.startsWith('LICENSES/'));

/** The GitHub anchor of a heading: lower case, punctuation dropped, spaces to hyphens. */
const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

const anchorsOf = new Map();
function anchors(file) {
  if (!anchorsOf.has(file)) {
    const set = new Set();
    const seen = new Map();
    let fenced = false;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (line.startsWith('```')) fenced = !fenced;
      const m = !fenced && /^#{1,6}\s+(.*)$/.exec(line);
      if (m) {
        const base = slug(m[1]);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        set.add(n === 0 ? base : `${base}-${n}`);
      }
    }
    anchorsOf.set(file, set);
  }
  return anchorsOf.get(file);
}

const problems = [];
const problem = (file, line, message) => problems.push(`${file}:${line}: ${message}`);

for (const file of files) {
  let fenced = false;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((text, i) => {
      const line = i + 1;
      if (text.startsWith('```')) {
        fenced = !fenced;
        return;
      }
      // Links.
      if (!fenced) {
        for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
          const target = m[1];
          if (/^(https?:|mailto:)/.test(target)) continue;
          const [path, anchor] = target.split('#');
          const resolved = path === '' ? file : normalize(join(dirname(file), path));
          if (!existsSync(resolved)) problem(file, line, `broken link to ${path}`);
          else if (anchor && resolved.endsWith('.md') && !anchors(resolved).has(anchor))
            problem(file, line, `no heading for #${anchor} in ${resolved}`);
        }
      }
      // Paths in code spans.
      for (const m of text.matchAll(/`([^`\n]+)`/g)) {
        const span = m[1];
        const first = span.split('/')[0];
        if (!PATH_ROOTS.includes(first) || !span.includes('/')) continue;
        if (/[*<>{}\s]/.test(span) || span.includes('...')) continue;
        const path = span.replace(/[.,;:]+$/, '').replace(/\/$/, '');
        if (!existsSync(path) && !PLANNED.has(path))
          problem(
            file,
            line,
            `\`${path}\` does not exist (if it is planned, list it in scripts/check-docs.mjs)`,
          );
      }
      // pnpm commands, in code spans and code blocks only (prose may use the word).
      const code = fenced ? text : [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).join('\n');
      for (const m of code.matchAll(/\bpnpm( run)? ([a-z][\w:-]*)/g)) {
        const name = m[2];
        if (!(name in pkg.scripts) && !PNPM_BUILTINS.has(name))
          problem(file, line, `pnpm ${name} is not a script in package.json`);
        // pnpm has its own `licenses` command, so the script has to be started with `run`.
        if (name === 'licenses' && !m[1])
          problem(file, line, 'use `pnpm run licenses` (pnpm has a built-in `licenses` command)');
      }
    });
}

// Every data file is described in docs/DATA_FILES.md.
if (existsSync('docs/DATA_FILES.md')) {
  const described = readFileSync('docs/DATA_FILES.md', 'utf8');
  for (const f of execFileSync('git', ['ls-files', 'data/*.json', 'data/**/*.json'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean))
    if (!described.includes(`\`${f}\``)) problem('docs/DATA_FILES.md', 0, `does not describe ${f}`);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} documentation problem(s).`);
  process.exit(1);
}
console.log(`Documentation check passed for ${files.length} files.`);
