// SPEC 8.2 content security policy. The build writes it into the window's page.
const DIRECTIVES: Array<[string, string]> = [
  ['default-src', "'self'"],
  ['img-src', "'self' adman-asset: data: blob:"],
  ['media-src', 'adman-asset:'],
  ['font-src', "'self' adman-asset:"],
  ['style-src', "'self' 'unsafe-inline'"],
  ['script-src', "'self'"],
  ['connect-src', "'none'"],
  ['frame-src', "'none'"],
  ['object-src', "'none'"],
  ['base-uri', "'none'"],
  ['form-action', "'none'"],
]

const join = (d: Array<[string, string]>) => d.map(([k, v]) => `${k} ${v}`).join('; ')

export const CONTENT_SECURITY_POLICY = join(DIRECTIVES)

// The development server injects an inline script and talks over a web socket for
// hot reload. Used by `npm run dev` only; packaged builds get the policy above.
export function devContentSecurityPolicy(serverUrl: string): string {
  const ws = serverUrl.replace(/^http/, 'ws')
  return join(
    DIRECTIVES.map(([k, v]): [string, string] => {
      if (k === 'script-src') return [k, `${v} 'unsafe-inline'`]
      if (k === 'connect-src') return [k, `${serverUrl} ${ws}`]
      return [k, v]
    }),
  )
}
