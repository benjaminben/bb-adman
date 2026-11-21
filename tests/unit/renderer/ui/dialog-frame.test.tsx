import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { DialogFoot, DialogFrame, type DialogFrameProps } from '@/renderer/ui/dialog-frame'
import styles from '@/renderer/ui/dialog-frame/dialog-frame.module.css'
import { axeViolations } from '../render'

function Opener(props: { closable?: boolean; onClose?: () => void; description?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <h1>Page</h1>
      <button type="button" onClick={() => setOpen(true)}>
        Open it
      </button>
      <DialogFrame
        open={open}
        title="Find missing files"
        description={props.description}
        closable={props.closable}
        onClose={() => {
          props.onClose?.()
          setOpen(false)
        }}
      >
        <button type="button">Inside</button>
      </DialogFrame>
    </main>
  )
}

async function openDialog(props: Parameters<typeof Opener>[0] = {}) {
  render(<Opener {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Open it' }))
  return screen.getByRole('dialog', { name: 'Find missing files' })
}

describe('dialog frame [spec/screens-campaign.md, Rules for these screens]', () => {
  it('shows the title, the description and the content', async () => {
    const dialog = await openDialog({ description: 'Adman copies the project.' })
    expect(dialog).toHaveAccessibleDescription('Adman copies the project.')
    expect(screen.getByRole('button', { name: 'Inside' })).toBeInTheDocument()
  })

  it('draws nothing while closed', () => {
    render(<Opener />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['Escape', true, 1],
    ['a click outside', true, 1],
    ['Escape', false, 0],
    ['a click outside', false, 0],
  ])('on %s with closable %s calls onClose %i time(s)', async (how, closable, calls) => {
    const onClose = vi.fn()
    await openDialog({ closable, onClose })
    if (how === 'Escape') await userEvent.keyboard('{Escape}')
    else await userEvent.setup({ pointerEventsCheck: 0 }).click(document.body)
    expect(onClose).toHaveBeenCalledTimes(calls)
    expect(screen.queryByRole('dialog') === null).toBe(calls === 1)
  })

  it('gives focus back to the control that opened it', async () => {
    await openDialog()
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Open it' })).toHaveFocus()
  })

  it("gives focus to the page's heading when the opener is gone", async () => {
    function Gone() {
      const [open, setOpen] = useState(false)
      return (
        <main>
          <h1>Page</h1>
          {!open && (
            <button type="button" onClick={() => setOpen(true)}>
              Open it
            </button>
          )}
          <DialogFrame open={open} title="Import" onClose={() => setOpen(false)}>
            <button type="button">Inside</button>
          </DialogFrame>
        </main>
      )
    }
    render(<Gone />)
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('heading', { name: 'Page' })).toHaveFocus()
  })

  it('has no axe violations while open', async () => {
    await openDialog({ description: 'A description.' })
    expect(await axeViolations()).toEqual([])
  })
})

describe('dialog frame bands, footer and size [spec/phases/app-style.md, ST-4]', () => {
  function Banded(props: { footer?: ReactNode; size?: DialogFrameProps['size'] }) {
    return (
      <DialogFrame open title="Package project" onClose={() => {}} {...props}>
        <label>
          Name <input />
        </label>
        <button type="button">Last inside</button>
      </DialogFrame>
    )
  }

  it('draws the footer after the children and inside the dialog', () => {
    render(<Banded footer={<button type="button">Done</button>} />)
    const dialog = screen.getByRole('dialog', { name: 'Package project' })
    const done = screen.getByRole('button', { name: 'Done' })
    const last = screen.getByRole('button', { name: 'Last inside' })
    expect(dialog).toContainElement(done)
    expect(last.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(done.parentElement).toHaveClass(styles.foot as string)
  })

  it('moves Tab from the last body control to the first footer button', async () => {
    const footer = (
      <>
        <button type="button">Cancel</button>
        <button type="button">Done</button>
      </>
    )
    render(<Banded footer={footer} />)
    screen.getByRole('button', { name: 'Last inside' }).focus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it.each([
    [undefined, 'normal'],
    ['normal', 'normal'],
    ['wide', 'wide'],
    ['large', 'large'],
  ] as const)('with size %s sets the %s width class', (size, name) => {
    render(<Banded size={size} />)
    const dialog = screen.getByRole('dialog', { name: 'Package project' })
    for (const each of ['normal', 'wide', 'large'] as const) {
      if (each === name) expect(dialog).toHaveClass(styles[each] as string)
      else expect(dialog).not.toHaveClass(styles[each] as string)
    }
  })

  it('without the new props draws the title, then the content, and no foot band', () => {
    render(<Banded />)
    const dialog = screen.getByRole('dialog', { name: 'Package project' })
    const heading = screen.getByRole('heading', { name: 'Package project' })
    const last = screen.getByRole('button', { name: 'Last inside' })
    expect(heading.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(dialog.querySelector(`.${styles.foot as string}`)).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('draws a DialogFoot row in the body with the foot band look', () => {
    render(
      <DialogFrame open title="Find missing files" onClose={() => {}}>
        <DialogFoot>
          <button type="button">Close</button>
        </DialogFoot>
      </DialogFrame>,
    )
    const row = screen.getByRole('button', { name: 'Close' }).parentElement
    expect(row).toHaveClass(styles.foot as string)
    expect(row?.parentElement).toHaveClass(styles.body as string)
  })
})
