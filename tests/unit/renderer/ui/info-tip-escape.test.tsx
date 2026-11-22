// Z-1b fix 1: with an InfoTip open, the first Escape closes only the tip and hands focus back to
// its button; the next Escape does what it did before (closes the dialog, leaves the sub-page).
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { InfoTip } from '@/renderer/ui/info-tip'
import { SubPage } from '@/renderer/ui/sub-page'

const tip = () => screen.getByRole('button', { name: 'About keys' })

describe('InfoTip Escape [Z-1b]', () => {
  it('inside a DialogFrame: the first Escape closes the tip, the second the dialog', async () => {
    const onClose = vi.fn()
    render(
      <DialogFrame open onClose={onClose} title="Google Gemini key">
        <InfoTip about="keys">Keys stay on this computer.</InfoTip>
      </DialogFrame>,
    )
    await userEvent.click(tip())
    expect(tip()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
    expect(tip()).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Google Gemini key' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('inside a SubPage: the first Escape closes the tip and stays on the page', async () => {
    const onBack = vi.fn()
    render(
      <main>
        <SubPage title="Server folders" onBack={onBack}>
          <InfoTip about="keys">Keys stay on this computer.</InfoTip>
        </SubPage>
      </main>,
    )
    await userEvent.click(tip())
    await userEvent.keyboard('{Escape}')
    expect(tip()).toHaveAttribute('aria-expanded', 'false')
    expect(tip()).toHaveFocus()
    expect(onBack).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onBack).toHaveBeenCalledOnce()
  })
})
