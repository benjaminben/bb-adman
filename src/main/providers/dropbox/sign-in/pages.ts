// The fixed pages the sign-in listener answers with (spec/phases/phase-09.md "The sign-in
// redirect"). Every page is fixed text from the code: no value from the request is ever in
// it, so nothing a browser sent is echoed back.
import { SIGN_IN_PAGES } from '@/shared/publish/messages'

export type SignInPageKind = 'done' | 'wrongState' | 'notFound'

export type SignInPage = { status: number; headers: Record<string, string>; body: string }

const NOT_FOUND = 'Not found.'

const PAGES: Record<SignInPageKind, { status: number; text: string }> = {
  done: { status: 200, text: SIGN_IN_PAGES.done },
  wrongState: { status: 400, text: SIGN_IN_PAGES.wrongState },
  notFound: { status: 404, text: NOT_FOUND },
}

export const PAGE_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'",
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  connection: 'close',
}

// The texts hold no character that needs escaping in HTML.
function html(text: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Adman</title></head><body><p>${text}</p></body></html>`
}

export function signInPage(kind: SignInPageKind): SignInPage {
  const { status, text } = PAGES[kind]
  const body = html(text)
  return {
    status,
    headers: { ...PAGE_HEADERS, 'content-length': String(Buffer.byteLength(body)) },
    body,
  }
}
