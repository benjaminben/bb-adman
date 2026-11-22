// R2P-3 review: on Windows, opening a network path (\\server\share\a.png) or a device path
// sends the user's Windows sign-in to the server it names. A brief is read as soon as it is
// loaded, so such a path is never opened: it gets the "could not be read" note and no file call.
import fsp from 'node:fs/promises'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { checkBriefPictures } from '@/main/assets/brief-pictures'

afterEach(() => vi.restoreAllMocks())

const NETWORK = [
  '\\\\files.example\\share\\a.png',
  '//files.example/share/a.png',
  '\\/files.example/share/a.png',
  '\\\\?\\C:\\shoots\\a.png',
  '\\\\.\\C:\\shoots\\a.png',
]

describe('a brief that names a Windows network or device path [R2P-3 review]', () => {
  it.each(NETWORK)('does not open %s on win32', async (text) => {
    const spies = [
      vi.spyOn(fsp, 'realpath'),
      vi.spyOn(fsp, 'stat'),
      vi.spyOn(fsp, 'open'),
      vi.spyOn(fsp, 'readFile'),
    ]
    const [result] = await checkBriefPictures(null, [{ pictures: [text] }], { platform: 'win32' })
    expect(result).toEqual({
      paths: [],
      assetIds: [],
      notes: [{ name: 'a.png', reason: 'not_readable' }],
    })
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })

  it('still checks a drive path on win32 and a double slash elsewhere', async () => {
    const realpath = vi.spyOn(fsp, 'realpath')
    await checkBriefPictures(null, [{ pictures: ['C:\\shoots\\a.png'] }], { platform: 'win32' })
    await checkBriefPictures(null, [{ pictures: ['//shoots/a.png'] }], { platform: 'darwin' })
    expect(realpath).toHaveBeenCalledTimes(2)
  })
})
