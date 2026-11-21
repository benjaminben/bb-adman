import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

const nodeBuiltins = ['node:*', 'fs', 'fs/*', 'path', 'os', 'child_process', 'crypto', 'url']

// SPEC 12 module rule: only the path resolver may build asset paths.
const assetPathJoin = {
  selector:
    "CallExpression[callee.object.name='path'][callee.property.name=/^(join|resolve)$/] MemberExpression[property.name=/^(abs_path|rel_path|absPath|relPath)$/]",
  message: 'Only src/main/assets/path-resolver.ts may build asset file paths.',
}

// SPEC 12 "Electron stays at the edge": only these files import electron. Nothing core.ts
// can reach may import electron or one of these files, so the rule bans both.
const electronEdge = [
  'src/main/index.ts',
  'src/main/windows/**',
  'src/main/secrets/safe-storage.ts',
  'src/main/render/**',
]
const edgeMessage =
  'Only index.ts, windows/, secrets/safe-storage.ts and render/ may use Electron (SPEC 12).'
// The render folder is banned by its files only (render/<file>): queries/render.ts and
// config/render.ts share the name and are not at the edge (spec/editor-commands.md).
const edgeFiles = ['**/windows', '**/windows/**', '**/render/**', '**/safe-storage']

// spec/structure.md: code in src/ reaches another folder through @/, never ../. This pattern
// goes inside every block under src/: a later block's no-restricted-imports replaces an
// earlier one for the same file, so one block over src/** would switch the others off.
const noClimbing = {
  regex: '^\\.\\./',
  message: 'Import from another folder through @/, not ../ (spec/structure.md).',
}

// One block per folder depth, because the relative path to src/main/index.ts differs.
function electronBoundary(files, mainIndex) {
  return {
    files,
    ignores: electronEdge,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'electron', message: edgeMessage }],
          patterns: [
            { group: [...edgeFiles, ...mainIndex, '@/main/index'], message: edgeMessage },
            noClimbing,
          ],
        },
      ],
    },
  }
}

// Files no other block under src/ covers: the preload and the Electron edge files.
const uncoveredSrc = {
  files: ['src/preload/**', ...electronEdge],
  rules: { 'no-restricted-imports': ['error', { patterns: [noClimbing] }] },
}

export default tseslint.config(
  {
    ignores: [
      'out/',
      'dist/',
      'coverage/',
      'node_modules/',
      'test-results/',
      'src/main/db/migrations/',
      'design/',
      'playwright-report/',
      '.claude/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // SPEC 12 code rules: 300 lines is the hard limit.
      'max-lines': ['error', { max: 300 }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['error'] }],
      'no-restricted-syntax': ['error', assetPathJoin],
    },
  },
  {
    files: ['src/main/assets/path-resolver.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  electronBoundary(['src/main/*.ts'], ['./index']),
  electronBoundary(['src/main/*/*.ts'], ['../index']),
  electronBoundary(['src/main/*/*/**/*.ts'], ['../../index', '../../../index']),
  uncoveredSrc,
  {
    files: ['src/shared/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', ...nodeBuiltins],
              message: 'src/shared has no Electron or Node imports.',
            },
            {
              group: ['**/main/**', '**/renderer/**', '**/preload/**'],
              message: 'src/shared imports nothing from main, renderer or preload.',
            },
            noClimbing,
          ],
        },
      ],
    },
  },
  {
    files: ['src/renderer/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', ...nodeBuiltins],
              message: 'The window reaches the main process only through window.api.',
            },
            {
              group: ['**/main/**', '**/preload/**'],
              message: 'The window reaches the main process only through window.api.',
            },
            noClimbing,
          ],
        },
      ],
    },
  },
  prettier,
)
