// Bindings only the tests have, set in vitest.config.ts: the migrations and a key made per run.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
    API_KEY: string
  }
}

// Vite's ?raw import: a file's text, used to read wrangler.jsonc inside the Workers runtime.
declare module '*?raw' {
  const text: string
  export default text
}
