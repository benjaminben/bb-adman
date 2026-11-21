import { describe, it, expect } from 'vitest'
import { fileSize } from '@/renderer/dialogs/package-dialog/file-size'

const KB = 1024
const MB = KB * 1024
const GB = MB * 1024

describe('fileSize [spec/screens-campaign.md, Package project]', () => {
  it.each([
    [0, '0.0 KB'],
    [300, '0.3 KB'],
    [KB, '1.0 KB'],
    [1536, '1.5 KB'],
    [MB - 1, '1.0 MB'],
    [MB, '1.0 MB'],
    [Math.round(48.25 * MB), '48.3 MB'],
    [GB - KB, '1.0 GB'],
    [GB, '1.0 GB'],
    [Math.round(2.34 * GB), '2.3 GB'],
    [3000 * GB, '3000.0 GB'],
  ])('%i bytes read as %s', (bytes, text) => {
    expect(fileSize(bytes)).toBe(text)
  })
})
