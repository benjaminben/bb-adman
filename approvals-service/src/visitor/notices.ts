// spec/approvals-service.md "Notices": the address's `m` is looked up in this fixed table and
// only its key goes on. A page never shows text from the address.

export type NoticePage = 'password' | 'gallery'

export const NOTICES = {
  'wrong-password': {
    page: 'password',
    text: 'That password did not work. If you have tried many times, wait 15 minutes and try again.',
  },
  signed: { page: 'gallery', text: 'Your sign-off was saved.' },
  removed: { page: 'gallery', text: 'The sign-off was removed.' },
  changed: {
    page: 'gallery',
    text:
      'This variant changed while you were looking. Look at it again, and sign off if you still ' +
      'approve.',
  },
  'bad-email': { page: 'gallery', text: 'Enter a full email address, like name@company.com.' },
  'email-saved': {
    page: 'gallery',
    text: 'Your email is saved until you log out or close the browser.',
  },
  'signed-all': { page: 'gallery', text: 'Your sign-offs were saved.' },
  'gallery-changed': {
    page: 'gallery',
    text:
      'The gallery changed while you were looking. Nothing was signed. Look at it again, and ' +
      'sign off if you still approve.',
  },
} as const satisfies Record<string, { page: NoticePage; text: string }>

export type NoticeKey = keyof typeof NOTICES

const isKey = (m: string): m is NoticeKey => Object.hasOwn(NOTICES, m)

// The key for `m` when it is in the table and belongs on this page; otherwise null.
export function noticeOn(page: NoticePage, m: string | null): NoticeKey | null {
  if (m === null || !isKey(m)) return null
  return NOTICES[m].page === page ? m : null
}
