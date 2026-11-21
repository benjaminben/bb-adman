import { describe, it, expect, vi } from 'vitest'
import type { AdmanApi } from '@/shared/schemas/api'
import { pickPath } from '@/renderer/app/app-context'

function apiAnswering(data: unknown): { api: AdmanApi; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ ok: true, data })
  return { api: { query } as unknown as AdmanApi, query }
}

describe('pickPath with dialog.pickSaveFile [Phase 6 section 1, P6-8]', () => {
  it('asks for the translation sheet with the suggested path and returns the chosen one', async () => {
    const { api, query } = apiAnswering({ path: '/w/sheet.csv' })
    expect(await pickPath(api, 'dialog.pickSaveFile', '/w/a.csv')).toBe('/w/sheet.csv')
    expect(query).toHaveBeenCalledWith('dialog.pickSaveFile', {
      purpose: 'translation-sheet',
      defaultPath: '/w/a.csv',
    })
  })

  it('returns null when the dialog is cancelled', async () => {
    const { api } = apiAnswering({ path: null })
    expect(await pickPath(api, 'dialog.pickSaveFile')).toBeNull()
  })
})
