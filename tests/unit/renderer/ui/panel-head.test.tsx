// T3e (spec/phases/design-wave.md; spec/app-style-parts.md, "Panel and PanelHead"): a side
// panel's header row: an optional kind icon, the title at its level, an optional close button.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PanelHead } from '@/renderer/ui/panel-head'
import { axeViolations } from '../render'

describe('PanelHead [T3e]', () => {
  it('shows the title as a level 2 heading by default', () => {
    render(<PanelHead title="Activity" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Activity' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('takes the heading level 3', () => {
    render(<PanelHead title="Layers" level={3} icon="layers" />)
    expect(screen.getByRole('heading', { level: 3, name: 'Layers' })).toBeInTheDocument()
  })

  it('with onClose draws an icon button named and titled by closeLabel', async () => {
    const onClose = vi.fn()
    render(<PanelHead title="Activity" onClose={onClose} closeLabel="Close activity" />)
    const close = screen.getByRole('button', { name: 'Close activity' })
    expect(close).toHaveAttribute('title', 'Close activity')
    expect(close.querySelector('svg')).not.toBeNull()
    await userEvent.click(close)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('sets the title in the body face, bold, at the body size, on one row', () => {
    const css = fs
      .readFileSync(path.resolve('src/renderer/ui/panel-head/panel-head.module.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const rule = (name: string) => css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    expect(rule('title')).toMatch(/font-family:\s*var\(--font-body\)/)
    expect(rule('title')).toMatch(/font-size:\s*var\(--type-body-size\)/)
    expect(rule('title')).toMatch(/font-weight:\s*var\(--weight-bold\)/)
    expect(rule('head')).toMatch(/height:\s*var\(--row-height\)/)
    expect(rule('head')).toMatch(/border-bottom:\s*var\(--border-width\) solid var\(--color-line\)/)
  })

  it('passes axe', async () => {
    render(
      <main>
        <PanelHead title="Activity" icon="pulse" onClose={() => {}} closeLabel="Close activity" />
      </main>,
    )
    expect(await axeViolations()).toEqual([])
  })
})
