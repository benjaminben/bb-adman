// Z-1b fix 5: DialogFrame takes an optional `icon`, drawn before the title text and hidden from
// screen readers, so the dialog's name is unchanged. The key dialog passes "key".
import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { KeyDialog } from '@/renderer/dialogs/key-dialog'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'

const titleOf = (name: string) => screen.getByRole('heading', { name })

describe('the dialog title icon [Z-1b]', () => {
  it('draws the icon hidden, before the words, keeping the name', () => {
    render(
      <DialogFrame open onClose={() => {}} title="Google Gemini key" icon="key">
        <p>Body</p>
      </DialogFrame>,
    )
    const title = titleOf('Google Gemini key')
    const svg = title.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(title.firstElementChild).toContainElement(svg as unknown as HTMLElement)
    expect(title).toHaveTextContent(/^Google Gemini key$/)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Google Gemini key')
  })

  it('draws no icon without the prop', () => {
    render(
      <DialogFrame open onClose={() => {}} title="Plain">
        <p>Body</p>
      </DialogFrame>,
    )
    expect(titleOf('Plain').querySelector('svg')).toBeNull()
    expect(titleOf('Plain').childElementCount).toBe(0)
  })

  it('the key dialog shows the key icon and keeps "{Provider} key" as its name', async () => {
    const view = await renderApp(<KeyDialog />, makeFakeApi())
    const provider = view.store.getState().app?.providers.find((p) => p.id === 'gemini')
    if (!provider) throw new Error('no provider gemini')
    act(() => view.store.setState({ keyRequest: { provider, resolve: () => {} } }))
    const dialog = screen.getByRole('dialog', { name: `${provider.label} key` })
    expect(titleOf(`${provider.label} key`).querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(dialog).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })
})
