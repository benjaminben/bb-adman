// spec/phases/phase-07-slices-2.md, P7-17: the top bar's "Format" choice sends
// variant.setFormat; for a video, "Length (seconds)" (one decimal, 0.5 to 86,400) sends
// variant.update { durationMs } on Enter or leaving the field, and Escape puts the stored value
// back. A refusal shows its sentence under the controls and the controls keep the stored values.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppProvider } from '@/renderer/app/app-context'
import { FormatFields } from '@/renderer/editor/format-fields'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { VIDEO_REASON_MESSAGES } from '@/shared/video/messages'
import { axeViolations, renderApp } from '../render'
import { P, variant } from '../screens/campaign/campaign-fixture'

const IMAGE = variant('V1', { format: 'image', durationMs: 6000 })
const VIDEO = variant('V1', { format: 'video', durationMs: 8000 })
const GRID = VIDEO_REASON_MESSAGES.video_post_exists

const refused = (message: string) => () => ({
  ok: false as const,
  error: { code: 'RULE_VIOLATION' as const, message, details: { reason: 'video_post_exists' } },
})

async function setup(v: VariantSummary) {
  const view = await renderApp(
    <main>
      <FormatFields projectId={P} variant={v} />
    </main>,
  )
  const sent = (name: string) => view.fake.commands.filter((c) => c.name === name)
  const rerender = (next: VariantSummary) =>
    view.rerender(
      <AppProvider api={view.fake.api} store={view.store}>
        <main>
          <FormatFields projectId={P} variant={next} />
        </main>
      </AppProvider>,
    )
  return { ...view, sent, rerender }
}

const length = () => screen.getByRole('textbox', { name: 'Length (seconds)' })

describe('FormatFields: the format choice [P7-17]', () => {
  it('shows "Format" with Image and Video, the stored one checked, and no length for an image', async () => {
    await setup(IMAGE)
    const group = screen.getByRole('radiogroup', { name: 'Format' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Image' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Video' })).not.toBeChecked()
    expect(screen.queryByRole('textbox', { name: 'Length (seconds)' })).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('sends variant.setFormat when Video is chosen with the keyboard', async () => {
    const { sent } = await setup(IMAGE)
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Image' }))
    await user.keyboard('{ArrowRight}')
    expect(sent('variant.setFormat').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V1', format: 'video' },
    ])
  })

  it('sends Image for a video and shows the stored choice until the change arrives', async () => {
    const { sent } = await setup(VIDEO)
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Image' }))
    expect(sent('variant.setFormat').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V1', format: 'image' },
    ])
    expect(screen.getByRole('radio', { name: 'Video' })).toBeChecked()
  })

  it('shows the grid refusal under the controls and keeps the stored format', async () => {
    const { fake } = await setup(IMAGE)
    fake.onCommand('variant.setFormat', refused(GRID))
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Video' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(GRID)
    expect(screen.getByRole('radio', { name: 'Image' })).toBeChecked()
    expect(await axeViolations()).toEqual([])
  })
})

describe('FormatFields: the length of a video [P7-17]', () => {
  it('shows the stored length in seconds with one decimal', async () => {
    await setup(VIDEO)
    expect(length()).toHaveValue('8.0')
    expect(await axeViolations()).toEqual([])
  })

  it.each([
    ['12.5', 12_500],
    ['2.34', 2_300],
    ['0.1', 500],
    ['100000', 86_400_000],
    [' 3 ', 3_000],
  ])('sends %s on Enter as %i milliseconds', async (typed, durationMs) => {
    const { sent } = await setup(VIDEO)
    const user = userEvent.setup()
    await user.clear(length())
    await user.type(length(), `${typed}{Enter}`)
    expect(sent('variant.update').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V1', durationMs },
    ])
  })

  it('sends once on leaving the field, and nothing for the stored value', async () => {
    const { sent } = await setup(VIDEO)
    const user = userEvent.setup()
    await user.click(length())
    await user.tab()
    expect(sent('variant.update')).toEqual([])
    await user.clear(length())
    await user.type(length(), '9')
    await user.tab()
    expect(sent('variant.update').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V1', durationMs: 9_000 },
    ])
  })

  it('puts the stored value back on Escape and sends nothing', async () => {
    const { sent } = await setup(VIDEO)
    const user = userEvent.setup()
    await user.clear(length())
    await user.type(length(), '20{Escape}')
    expect(length()).toHaveValue('8.0')
    await user.tab()
    expect(sent('variant.update')).toEqual([])
  })

  it('puts the stored value back for text that is not a number', async () => {
    const { sent } = await setup(VIDEO)
    const user = userEvent.setup()
    await user.clear(length())
    await user.type(length(), 'long{Enter}')
    expect(length()).toHaveValue('8.0')
    expect(sent('variant.update')).toEqual([])
  })

  it('shows a refusal and keeps the stored length; a later save clears it', async () => {
    const { fake } = await setup(VIDEO)
    fake.onCommand('variant.update', refused('The length could not be saved.'))
    const user = userEvent.setup()
    await user.clear(length())
    await user.type(length(), '30{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('The length could not be saved.')
    expect(length()).toHaveValue('8.0')
    fake.onCommand('variant.update', () => ({ ok: true, data: null }))
    await user.clear(length())
    await user.type(length(), '31{Enter}')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a new stored length when it arrives', async () => {
    const { rerender } = await setup(VIDEO)
    act(() => {
      rerender({ ...VIDEO, durationMs: 15_000 })
    })
    expect(length()).toHaveValue('15.0')
  })
})
