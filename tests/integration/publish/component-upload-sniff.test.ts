// P9-13, review fix 1 (spec/phases/phase-09.md "Components"): a picture's first bytes are
// checked from the pinned handle, not from its path before the open. A file swapped for one that
// is not a picture between the path check and the open is skipped as wrong_type.
import fs from 'node:fs'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { componentUpload } from '@/main/publish/component-upload'
import { CAMPAIGN, BYTES, makeComponentProject } from './component-project'

// Runs once, just after the path check of the next component file.
const afterCheck = vi.hoisted(() => ({ run: null as null | (() => void) }))

vi.mock('@/main/publish/component-file', async (load) => {
  const real = await load<typeof import('@/main/publish/component-file')>()
  return {
    ...real,
    checkComponentFile: async (...args: Parameters<typeof real.checkComponentFile>) => {
      const checked = await real.checkComponentFile(...args)
      afterCheck.run?.()
      afterCheck.run = null
      return checked
    },
  }
})

let p: ReturnType<typeof makeComponentProject> | undefined
afterEach(() => {
  p?.cleanup()
  p = undefined
  afterCheck.run = null
})

const ID = '01JD0000000000000000000003'

function picture() {
  p = makeComponentProject()
  const abs = p.asset({ id: ID, file: 'pics/hero.png' })
  const component = {
    assetId: ID,
    displayName: 'Hero',
    kind: 'image' as const,
    folder: 'images' as const,
    localPath: abs,
    problem: null,
    share: null,
    remotePath: `${CAMPAIGN}/components/images/${ID}.png`,
    absPath: abs,
  }
  return { handle: p.handle, abs, component }
}

const noFonts = () => false

describe('a picture checked from its pinned handle [P9-13 review fix 1]', () => {
  it('uploads a picture whose bytes still fit', async () => {
    const { handle, component } = picture()
    const up = await componentUpload(handle, component, noFonts)
    expect('file' in up).toBe(true)
  })

  it('skips a picture rewritten as text after the path check', async () => {
    const { handle, abs, component } = picture()
    afterCheck.run = () => fs.writeFileSync(abs, BYTES.text)
    expect(await componentUpload(handle, component, noFonts)).toEqual({ problem: 'wrong_type' })
  })
})
