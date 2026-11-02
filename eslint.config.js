// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: Nexxus Drako Multimedia
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // All player-facing text lives in /locales/en.json (see "Localisation" in the GDD).
    files: ['src/ui/**/*.tsx', 'src/App.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\S/]',
          message: 'Hard-coded text is not allowed. Add a key to locales/en.json and use t().',
        },
        {
          selector:
            'JSXAttribute[name.name=/^(aria-label|title|alt|placeholder)$/] > Literal[value=/\\S/]',
          message: 'Hard-coded text is not allowed. Add a key to locales/en.json and use t().',
        },
      ],
    },
  },
);
