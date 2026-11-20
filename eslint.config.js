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
          ],
        },
      ],
    },
  },
  prettier,
)
