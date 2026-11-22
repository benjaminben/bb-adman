// Review leftovers: the export dialog's end line says "1 ad", not "1 ads".
import { describe, expect, it } from 'vitest'
import { exportDoneLine } from '@/shared/export/messages'

describe('the export end line', () => {
  it.each([
    [0, 0, 'Exported 0 ads. 0 failed.'],
    [1, 0, 'Exported 1 ad. 0 failed.'],
    [2, 1, 'Exported 2 ads. 1 failed.'],
  ])('%i exported, %i failed reads %j', (exported, failed, line) => {
    expect(exportDoneLine(exported, failed)).toBe(line)
  })
})
