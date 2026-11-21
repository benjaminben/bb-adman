import { fileURLToPath } from 'node:url'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { srcAlias } from './path-alias.config.js'
import { CONTENT_SECURITY_POLICY, devContentSecurityPolicy } from './src/main/windows/csp'

// Writes the SPEC 8.2 policy into the window page as a meta tag. The policy text has
// one owner: src/main/windows/csp.ts.
function contentSecurityPolicy(command: 'build' | 'serve'): Plugin {
  const policy =
    command === 'serve' ? devContentSecurityPolicy('http://localhost:*') : CONTENT_SECURITY_POLICY
  return {
    name: 'adman-csp',
    transformIndexHtml: (html) =>
      html.replace(
        '<!-- CSP -->',
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      ),
  }
}

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url))

export default defineConfig(({ command }) => ({
  main: { resolve: { alias: srcAlias } },
  preload: {
    resolve: { alias: srcAlias },
    build: {
      // A sandboxed preload must be one CommonJS file with nothing left to require.
      externalizeDeps: false,
      // Two preloads: the app window's and the render window's (spec/scene.md, "Files").
      rollupOptions: {
        input: { index: page('src/preload/index.ts'), render: page('src/preload/render.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    resolve: { alias: srcAlias },
    plugins: [react(), contentSecurityPolicy(command)],
    // Three pages, each given the policy tag: the app window's, the render window's and the
    // WebP decoder window's (slice WP).
    build: {
      rollupOptions: {
        input: {
          index: page('src/renderer/index.html'),
          render: page('src/renderer/render.html'),
          webp: page('src/renderer/webp.html'),
        },
      },
    },
  },
}))
