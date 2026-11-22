// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "How it opens"): the button
// that opens and closes the Assets panel of its scope.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AssetsButton } from '@/renderer/screens/assets/assets-button'
import { AssetsScope, useAssetsPanel } from '@/renderer/screens/assets/assets-scope'
import { axeViolations } from '../../render'

function Stand() {
  const panel = useAssetsPanel()
  return panel?.open ? <section id="assets-panel" aria-label="Assets" /> : null
}

const draw = (label?: string) =>
  render(
    <AssetsScope projectId="P1">
      <main>
        <AssetsButton projectId="P1" label={label} />
        <Stand />
      </main>
    </AssetsScope>,
  )

describe('AssetsButton [R2C-5]', () => {
  it('says "Assets" by default and "Open assets" when told', () => {
    draw()
    expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument()
    draw('Open assets')
    expect(screen.getByRole('button', { name: 'Open assets' })).toBeInTheDocument()
  })

  it('opens the panel, names it in aria-controls, and closes it on a second press', async () => {
    draw()
    const button = screen.getByRole('button', { name: 'Assets' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', 'assets-panel')
    expect(screen.getByRole('region', { name: 'Assets' })).toHaveAttribute('id', 'assets-panel')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Assets' })).toBeNull()
    expect(button).toHaveFocus()
  })

  it('draws nothing outside a scope or in the scope of another project', () => {
    render(<AssetsButton projectId="P1" />)
    render(
      <AssetsScope projectId="P2">
        <AssetsButton projectId="P1" />
      </AssetsScope>,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('has no accessibility violations, closed or open', async () => {
    draw()
    expect(await axeViolations()).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Assets' }))
    expect(await axeViolations()).toEqual([])
  })
})
