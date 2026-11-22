// spec/screens-campaign.md, "The campaign grid and the variant tile" (S2-16): the tile is one
// button holding the shape box, the title, the size line and the marks; `preview` replaces
// the box and `actions` sit beside the button.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VariantTile } from '@/renderer/screens/campaign/variant-tile'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../../render'
import { variant } from './campaign-fixture'

type Extra = { chosen?: boolean; preview?: ReactNode; actions?: ReactNode; footer?: ReactNode }

const draw = (v: VariantSummary, extra: Extra = {}) => {
  const onChoose = vi.fn()
  render(<VariantTile variant={v} chosen={false} onChoose={onChoose} {...extra} />)
  return { onChoose, button: screen.getAllByRole('button')[0]! }
}

const WORDS = [
  'Running',
  'New result',
  'Text does not fit',
  'File missing',
  'Translation not approved',
  'Out of date',
  'Check warning',
  'Not checked',
]

const POST = variant('V1', { title: 'Summer post', width: 1080, height: 1920, sizeLabel: '9:16' })

describe('VariantTile [S2-16]', () => {
  it.each([
    [false, '1080×1920 · en · image'],
    [true, '1080×1920 · en · image · master'],
  ])('shows the title and the size line (master: %s)', (isMaster, line) => {
    const { button } = draw({ ...POST, isMaster })
    expect(within(button).getByText('Summer post')).toBeInTheDocument()
    expect(within(button).getByText(line)).toBeInTheDocument()
  })

  it.each([
    ['image', false],
    ['video', true],
  ] as const)('draws a %s variant as a box in its shape, "Video" shown: %s', (format, video) => {
    const { button } = draw({ ...POST, format })
    const box = within(button).getByText('9:16').parentElement!
    expect(box.style.aspectRatio).toBe('1080 / 1920')
    expect(within(box).queryByText('Video') !== null).toBe(video)
  })

  it('shows a mark only when it is true', () => {
    const marked = { ...POST.badges, overflow: true, missingFile: true }
    const { button } = draw({ ...POST, badges: marked })
    expect(within(button).getByText('Text does not fit')).toBeInTheDocument()
    expect(within(button).getByText('File missing')).toBeInTheDocument()
    expect(within(button).queryByText('Running')).toBeNull()
    expect(within(button).queryByText('Not checked')).toBeNull()
  })

  it.each([true, false])('marks the button pressed when chosen is %s', (chosen) => {
    const { button } = draw(POST, { chosen })
    expect(button).toHaveAttribute('aria-pressed', String(chosen))
  })

  it.each([
    ['a click', (b: HTMLElement) => userEvent.click(b)],
    ['Enter', (b: HTMLElement) => (b.focus(), userEvent.keyboard('{Enter}'))],
    ['Space', (b: HTMLElement) => (b.focus(), userEvent.keyboard(' '))],
  ])('calls onChoose with the variant ID on %s', async (_name, act) => {
    const { onChoose, button } = draw(POST)
    await act(button)
    expect(onChoose).toHaveBeenCalledExactlyOnceWith('V1')
  })

  it('shows the preview in place of the shape box', () => {
    const { button } = draw(POST, { preview: <img alt="Summer post preview" src="blob:x" /> })
    expect(within(button).getByRole('img', { name: 'Summer post preview' })).toBeInTheDocument()
    expect(within(button).queryByText('9:16')).toBeNull()
  })

  it('draws the actions beside the main button, not inside it', () => {
    const { button } = draw(POST, {
      actions: <button type="button">Open Summer post in a tab</button>,
    })
    const extra = screen.getByRole('button', { name: 'Open Summer post in a tab' })
    expect(button.contains(extra)).toBe(false)
    expect(button.parentElement!.contains(extra)).toBe(true)
  })

  it('shows a title holding markup as plain characters', () => {
    const { button } = draw({ ...POST, title: '<b>Bold</b> post' })
    expect(within(button).getByText('<b>Bold</b> post')).toBeInTheDocument()
    expect(button.querySelector('b')).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const badges = { ...POST.badges, jobRunning: true }
    draw({ ...POST, badges }, { chosen: true, actions: <button type="button">Open</button> })
    expect(await axeViolations()).toEqual([])
  })

  it('draws the footer after the main button, not inside it [AP-12]', () => {
    const { button } = draw(POST, { footer: <p>Signed off by 1</p> })
    const footer = screen.getByText('Signed off by 1')
    expect(button.contains(footer)).toBe(false)
    expect(button.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(button.parentElement!.contains(footer)).toBe(true)
  })

  it('gives each mark an aria-hidden icon and keeps its words [ST-11]', () => {
    const all = Object.fromEntries(Object.keys(POST.badges).map((key) => [key, true]))
    const { button } = draw({ ...POST, badges: { ...POST.badges, ...all } })
    for (const word of WORDS) {
      const mark = within(button).getByText(word)
      expect(mark.textContent).toBe(word)
      const icon = mark.querySelector('svg')
      expect(icon).not.toBeNull()
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
  })
})

// R2C-2 (spec/phases/round-2-campaign.md, design addition 2, A-311): the master's tile has a
// "Master" badge with a hidden icon at the start of its title line; no other tile has one.
describe('VariantTile master mark [R2C-2]', () => {
  it('shows "Master" with a hidden icon on the master, before the title', () => {
    const { button } = draw({ ...POST, isMaster: true })
    const badge = within(button).getByText('Master')
    expect(badge.textContent).toBe('Master')
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    const title = within(button).getByText('Summer post')
    expect(badge.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows no "Master" on a variant that is not the master', () => {
    const { button } = draw(POST)
    expect(within(button).queryByText('Master')).toBeNull()
  })

  it('has no accessibility violations on the master', async () => {
    draw({ ...POST, isMaster: true }, { chosen: true })
    expect(await axeViolations()).toEqual([])
  })
})
