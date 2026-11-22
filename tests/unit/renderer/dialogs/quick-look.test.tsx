// spec/screens-variants.md, "Quick look" [REQ: FR-244]: the title, the picture from
// variant.render at 1024 through an object URL, the drawing and refused lines, Previous and
// Next and the arrow keys through the campaign's order with wrapping, "{i} of {n}", a late
// reply dropped, and Escape giving focus back to the tile's button.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import type { Result } from '@/shared/schemas/result'
import { axeViolations } from '../render'
import { P, campaignApi, renderWith } from '../screens/campaign/campaign-fixture'
import { heldReply } from '../screens/campaign/held-reply'
import { twoDirections } from './tile-actions-fixture'

const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
let made = 0
beforeEach(() => {
  made = 0
  URL.createObjectURL = vi.fn(() => `blob:picture-${++made}`)
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  URL.createObjectURL = original.create
  URL.revokeObjectURL = original.revoke
})

const drawn: Result<unknown> = {
  ok: true,
  data: { png: new Uint8Array([1]), width: 1024, height: 1024, rev: 1 },
}

async function draw(answer: (input: unknown) => Result<unknown> | Promise<Result<unknown>>) {
  const fake = campaignApi()
  fake.onQuery('variant.render', answer)
  const view = await renderWith(
    <main>
      <h1>Campaign</h1>
      <DirectionGrids
        projectId={P}
        campaign={twoDirections()}
        chosenId="V1"
        onChoose={() => {}}
        onOpenBehind={() => {}}
      />
    </main>,
    fake,
  )
  return view
}

const renders = (fake: ReturnType<typeof campaignApi>) =>
  fake.queries.filter((q) => q.name === 'variant.render').map((q) => q.input)
const dialog = () => screen.getByRole('dialog')
const titleOf = () => within(dialog()).getByRole('heading').textContent

async function open(title = 'Master post') {
  await userEvent.click(screen.getByRole('button', { name: `Quick look at ${title}` }))
  return dialog()
}

describe('Quick look [FR-244]', () => {
  it('titles the dialog and shows the picture from variant.render at 1024', async () => {
    const { fake } = await draw(() => drawn)
    await open()
    expect(titleOf()).toBe('Master post · 1:1 · en')
    const img = await within(dialog()).findByRole('img', { name: 'Master post' })
    expect(img).toHaveAttribute('src', 'blob:picture-1')
    expect(renders(fake)).toEqual([{ projectId: P, variantId: 'V1', maxDimension: 1024 }])
  })

  it('says "Drawing the variant…" while it draws, then the refusal line when refused', async () => {
    const held = heldReply()
    await draw(held.answer)
    await open()
    expect(within(dialog()).getByText('Drawing the variant…')).toBeInTheDocument()
    await act(async () =>
      held.release({ ok: false, error: { code: 'INTERNAL', message: 'No draw.' } }),
    )
    expect(await within(dialog()).findByText('The picture could not be drawn.')).toBeInTheDocument()
    expect(within(dialog()).queryByRole('img')).toBeNull()
  })

  it('moves through the campaign order with Next, Previous and the arrow keys, wrapping', async () => {
    const { fake } = await draw(() => drawn)
    await open()
    const at = () => [titleOf(), within(dialog()).getByText(/ \/ 3$/).textContent]
    expect(at()).toEqual(['Master post · 1:1 · en', '1 / 3'])
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Next' }))
    expect(at()).toEqual(['German post · 1:1 · de', '2 / 3'])
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Next' }))
    expect(at()).toEqual(['Night master · 9:16 · en', '3 / 3'])
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Next' }))
    expect(at()[1]).toBe('1 / 3')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Previous' }))
    expect(at()[1]).toBe('3 / 3')
    await userEvent.keyboard('{ArrowRight}')
    expect(at()[1]).toBe('1 / 3')
    await userEvent.keyboard('{ArrowLeft}')
    expect(at()[1]).toBe('3 / 3')
    await waitFor(() =>
      expect(renders(fake).map((i) => (i as { variantId: string }).variantId)).toEqual([
        'V1',
        'V2',
        'V3',
        'V1',
        'V3',
        'V1',
        'V3',
      ]),
    )
  })

  it('drops a late reply for the variant shown before', async () => {
    const first = heldReply()
    await draw((input) =>
      (input as { variantId: string }).variantId === 'V1' ? first.answer() : drawn,
    )
    await open()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Next' }))
    const img = await within(dialog()).findByRole('img', { name: 'German post' })
    await act(async () => first.release(drawn))
    expect(within(dialog()).getAllByRole('img')).toEqual([img])
    expect(img).toHaveAttribute('src', 'blob:picture-1')
    expect(titleOf()).toBe('German post · 1:1 · de')
  })

  it('frees the object URL when the picture changes and when the dialog closes', async () => {
    await draw(() => drawn)
    await open()
    await within(dialog()).findByRole('img', { name: 'Master post' })
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Next' }))
    await within(dialog()).findByRole('img', { name: 'German post' })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:picture-1')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:picture-2'))
  })

  it('closes on Escape and gives focus back to the tile\'s "Quick look" button', async () => {
    await draw(() => drawn)
    await open('German post')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Quick look at German post' })).toHaveFocus()
  })

  it('has no accessibility violations', async () => {
    await draw(() => drawn)
    await open()
    await within(dialog()).findByRole('img', { name: 'Master post' })
    expect(await axeViolations()).toEqual([])
  })
})
