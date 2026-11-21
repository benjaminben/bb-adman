import { describe, it, expect, vi } from 'vitest'
import { httpsOnly } from '@/main/windows/open-external'

describe('openExternal is restricted to https: addresses [SPEC 14 step 0 R1, 8.1]', () => {
  it('passes an https address to the system call', async () => {
    const open = vi.fn(async () => undefined)
    await httpsOnly(open)('https://www.dropbox.com/oauth2/authorize?x=1')
    expect(open).toHaveBeenCalledWith('https://www.dropbox.com/oauth2/authorize?x=1')
  })

  it.each(['http://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])(
    'refuses %s without calling the system',
    async (url) => {
      const open = vi.fn(async () => undefined)
      await expect(httpsOnly(open)(url)).rejects.toThrow(/https/)
      expect(open).not.toHaveBeenCalled()
    },
  )
})
