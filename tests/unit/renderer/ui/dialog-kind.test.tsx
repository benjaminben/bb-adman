// T4 (spec/app-style-parts.md, "Dialog"): the six kinds set the width (`size` wins), and the
// warning line in the head is read first as the dialog's accessible description.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DialogFrame, type DialogFrameProps } from '@/renderer/ui/dialog-frame'
import styles from '@/renderer/ui/dialog-frame/dialog-frame.module.css'
import { axeViolations } from '../render'

type Extra = Partial<Omit<DialogFrameProps, 'open' | 'onClose' | 'title' | 'children'>>

function draw(extra: Extra = {}, onClose = vi.fn()) {
  render(
    <main>
      <h1>Page</h1>
      <p id="body-line">Two variants are open.</p>
      <DialogFrame open title="Close the editor" onClose={onClose} {...extra}>
        <button type="button">Inside</button>
      </DialogFrame>
    </main>,
  )
  return screen.getByRole('dialog', { name: 'Close the editor' })
}

describe('dialog kinds set the width [T4]', () => {
  it.each([
    ['confirm', 'normal'],
    ['form', 'normal'],
    ['run', 'normal'],
    ['publish', 'wide'],
    ['pick', 'wide'],
    ['review', 'large'],
  ] as const)('kind %s gives the %s width', (kind, width) => {
    expect(draw({ kind })).toHaveClass(styles[width] ?? 'missing')
  })

  it('lets size win over kind', () => {
    const dialog = draw({ kind: 'form', size: 'wide' })
    expect(dialog).toHaveClass(styles.wide ?? 'missing')
    expect(dialog).not.toHaveClass(styles.normal ?? 'missing')
  })

  it.each([undefined, 'normal', 'wide', 'large'] as const)(
    'with no kind gives what size %s gives, as built',
    (size) => {
      expect(draw({ size })).toHaveClass(styles[size ?? 'normal'] ?? 'missing')
    },
  )
})

describe('the warning line [T4]', () => {
  it('shows in the head with a hidden icon and is the accessible description', async () => {
    const dialog = draw({ warning: 'Unsaved changes are lost.' })
    const line = within(dialog).getByText('Unsaved changes are lost.').closest('p')
    expect(line?.closest(`.${styles.head}`)).not.toBeNull()
    expect(line?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(dialog).toHaveAccessibleDescription('Unsaved changes are lost.')
    expect(await axeViolations()).toEqual([])
  })

  it('is read before a describedBy, and both are read', () => {
    const dialog = draw({ warning: 'Unsaved changes are lost.', describedBy: 'body-line' })
    expect(dialog).toHaveAccessibleDescription('Unsaved changes are lost. Two variants are open.')
  })

  it('is read before a description too', () => {
    const dialog = draw({ warning: 'Unsaved changes are lost.', description: 'Saves first.' })
    expect(dialog).toHaveAccessibleDescription('Unsaved changes are lost. Saves first.')
  })

  it('draws the words as plain text', () => {
    const dialog = draw({ warning: '<b>Lost</b> work' })
    expect(within(dialog).getByText('<b>Lost</b> work')).toBeInTheDocument()
    expect(dialog.querySelector('b')).toBeNull()
  })

  it('lets describedBy hold several ids', () => {
    render(<p id="second-line">Nothing is sent.</p>)
    const dialog = draw({ describedBy: 'body-line second-line' })
    expect(dialog).toHaveAccessibleDescription('Two variants are open. Nothing is sent.')
  })

  it('keeps the close rules: a dialog with a warning still waits when not closable', async () => {
    const onClose = vi.fn()
    draw({ warning: 'Unsaved changes are lost.', closable: false }, onClose)
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('the pick grid [T4]', () => {
  const css = fs
    .readFileSync(path.resolve('src/renderer/ui/dialog-frame/dialog-frame.module.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const body = css.match(/\.pickGrid\s*\{([^{}]*)\}/)?.[1] ?? ''

  it('is a grid of --thumbnail-tile columns, --gap-inline apart', () => {
    expect(body).toMatch(/display:\s*grid/)
    expect(body).toMatch(
      /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(var\(--thumbnail-tile\),\s*1fr\)\)/,
    )
    expect(body).toMatch(/gap:\s*var\(--gap-inline\)/)
  })
})
