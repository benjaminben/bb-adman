import { describe, it, expect } from 'vitest'
import { NOTICES, noticeOn, type NoticePage } from '../src/visitor/notices'

// spec/approvals-service.md "Notices": `m` becomes a key only through the fixed table.
describe('the notices table [approvals-service.md "Notices"]', () => {
  it('holds exactly the five notices, each on its one page, with the spec text', () => {
    expect(NOTICES).toEqual({
      'wrong-password': {
        page: 'password',
        text: 'That password did not work. If you have tried many times, wait 15 minutes and try again.',
      },
      signed: { page: 'gallery', text: 'Your sign-off was saved.' },
      removed: { page: 'gallery', text: 'The sign-off was removed.' },
      changed: {
        page: 'gallery',
        text: 'This variant changed while you were looking. Look at it again, and sign off if you still approve.',
      },
      'bad-email': { page: 'gallery', text: 'Enter a full email address, like name@company.com.' },
    })
  })

  const ROWS: [string | null, NoticePage, string | null][] = [
    ['wrong-password', 'password', 'wrong-password'],
    ['signed', 'gallery', 'signed'],
    ['removed', 'gallery', 'removed'],
    ['changed', 'gallery', 'changed'],
    ['bad-email', 'gallery', 'bad-email'],
    ['signed', 'password', null],
    ['wrong-password', 'gallery', null],
    [null, 'password', null],
    [null, 'gallery', null],
    ['', 'gallery', null],
    ['Signed', 'gallery', null],
    [' signed', 'gallery', null],
    ['signed ', 'gallery', null],
    ['<script>alert(1)</script>', 'gallery', null],
    ['__proto__', 'gallery', null],
    ['toString', 'password', null],
    ['constructor', 'gallery', null],
    ['hasOwnProperty', 'gallery', null],
  ]

  it.each(ROWS)('m=%j on the %s page gives %j', (m, page, expected) => {
    expect(noticeOn(page, m)).toBe(expected)
  })
})
