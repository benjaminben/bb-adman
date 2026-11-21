// spec/editor.md, "Thumbnails on the screens": each tile of the campaign grid shows its
// VariantThumbnail in the picture area.
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VariantGrid } from '@/renderer/screens/campaign/variant-grid'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { variant } from './campaign-fixture'

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

describe('VariantGrid thumbnails [spec/editor.md, Thumbnails on the screens]', () => {
  it("the grid shows each tile's thumbnail in its picture area", async () => {
    const fake = readyApi()
    const { container } = await renderApp(
      <main>
        <VariantGrid
          projectId="P1"
          variants={[variant('V1', { title: 'Master post', rev: 3 })]}
          chosenId="V1"
          onChoose={() => {}}
        />
      </main>,
      fake,
    )
    await waitFor(() => expect(container.querySelector('img[src="blob:thumb"]')).not.toBeNull())
    expect(asked(fake)).toEqual([{ projectId: 'P1', variantId: 'V1' }])
    expect(screen.getByRole('button', { name: /^Master post/ })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })
})
