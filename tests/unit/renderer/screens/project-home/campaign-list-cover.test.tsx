// spec/editor.md, "Thumbnails on the screens": each campaign row of the project home shows the
// VariantThumbnail of the campaign's cover, or an empty box when there is none.
import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignList } from '@/renderer/screens/project-home/campaign-list'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { campaign } from './project-fixture'

const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:thumb')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  URL.createObjectURL = original.create
  URL.revokeObjectURL = original.revoke
})

function readyApi() {
  const fake = makeFakeApi()
  fake.onQuery('thumbnail.get', () => ({
    ok: true,
    data: { state: 'ready', rev: 3, png: new Uint8Array([1]) },
  }))
  return fake
}

const asked = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'thumbnail.get').map((q) => q.input)

describe('CampaignList covers [spec/editor.md, Thumbnails on the screens]', () => {
  it('each campaign row shows its cover, and an empty box when there is none', async () => {
    const fake = readyApi()
    const summer = { ...campaign('summer-k3f9q2', 'Summer'), cover: { variantId: 'V1', rev: 3 } }
    await renderApp(
      <main>
        <CampaignList
          projectId="P1"
          campaigns={[summer, campaign('fall-p2x8r4', 'Fall')]}
          onOpen={() => {}}
        />
      </main>,
      fake,
    )
    const rows = within(screen.getByRole('list', { name: 'Campaigns' })).getAllByRole('listitem')
    expect(
      await within(rows[0] as HTMLElement).findByRole('img', { name: 'Cover of Summer' }),
    ).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).queryByRole('img')).toBeNull()
    expect(asked(fake)).toEqual([{ projectId: 'P1', variantId: 'V1' }])
    expect(await axeViolations()).toEqual([])
  })
})
