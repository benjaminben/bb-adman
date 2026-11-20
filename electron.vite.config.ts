import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
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

export default defineConfig(({ command }) => ({
  main: {},
  preload: {
    build: {
      // A sandboxed preload must be one CommonJS file with nothing left to require.
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    plugins: [react(), contentSecurityPolicy(command)],
  },
}))
