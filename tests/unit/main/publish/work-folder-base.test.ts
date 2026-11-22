// P8-17, from the review of video export: a work folder's base is one of the two fixed names,
// never a free string. Checked at compile time (npm run typecheck).
import { describe, expectTypeOf, it } from 'vitest'
import { EXPORT_WORK } from '@/main/export/video/work-dir'
import { makeWorkFolder, sweepWorkFolders, WORK_FOLDER } from '@/main/publish/work-folder'

type Bases = typeof WORK_FOLDER | typeof EXPORT_WORK

describe('work folder base names [P8-17]', () => {
  it('are exactly publish-work and export-work', () => {
    expectTypeOf<Bases>().toEqualTypeOf<'publish-work' | 'export-work'>()
    expectTypeOf<Parameters<typeof makeWorkFolder>[2]>().toEqualTypeOf<Bases | undefined>()
    expectTypeOf<Parameters<typeof sweepWorkFolders>[1]>().toEqualTypeOf<Bases>()
  })
})
