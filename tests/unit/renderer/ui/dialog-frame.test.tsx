import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
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
