// T3c (spec/app-style-parts.md, "ObjectRow"): the layer-row pattern, made shared. One fixed
// height, the actions laid over the right end, state actions and the More menu always shown.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectRow, type ObjectRowProps } from '@/renderer/ui/object-row'
import styles from '@/renderer/ui/object-row/object-row.module.css'
import { axeViolations } from '../render'

const css = fs
  .readFileSync(path.resolve('src/renderer/ui/object-row/object-row.module.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: (m[1] ?? '').trim(),
  body: m[2] ?? '',
}))
const body = (selector: string) => rules.find((r) => r.selector === selector)?.body ?? ''
const SIZING =
  /(^|[\s;])(height|min-height|max-height|padding[\w-]*|margin[\w-]*|display|position|flex-direction|flex-wrap|font-size|line-height|border|border-width)\s*:/

function Row(props: Partial<ObjectRowProps>) {
  return (
    <ul>
      <li>
        <ObjectRow
          name="Summer sale"
          label="Summer sale"
          stateActions={
            <button type="button" aria-label="Hide Summer sale">
              H
            </button>
          }
          actions={
            <button type="button" aria-label="Rename Summer sale">
              R
            </button>
          }
          more={
            <button type="button" aria-label="More actions for Summer sale">
              M
            </button>
          }
          {...props}
        />
      </li>
    </ul>
  )
}

function rowBox(): HTMLElement {
  const main = screen.getByRole('button', { name: 'Summer sale' })
  return main.parentElement as HTMLElement
}

describe('ObjectRow: one height, actions laid over [T3c]', () => {
  it('gives the box a fixed --row-height and lays the actions over it', () => {
    expect(body('.box')).toMatch(/(^|[\s;])height:\s*var\(--row-height\)/)
    expect(body('.box')).toMatch(/position:\s*relative/)
    expect(body('.actions')).toMatch(/position:\s*absolute/)
  })

  it('lets a row with meta grow from a min-height of --row-height', () => {
    expect(body('.box.withMeta')).toMatch(/min-height:\s*var\(--row-height\)/)
    render(<Row meta="3 variants" />)
    expect(rowBox()).toHaveClass(styles.withMeta)
    expect(screen.getByText('3 variants')).toBeInTheDocument()
  })

  it('changes no size on hover, focus or selection', () => {
    const stateful = rules.filter((r) => /:hover|:focus|\.selected/.test(r.selector))
    expect(stateful.length).toBeGreaterThan(0)
    expect(stateful.filter((r) => SIZING.test(r.body)).map((r) => r.selector)).toEqual([])
  })
})

describe('ObjectRow: which actions show [T3c]', () => {
  it('always draws the state actions and the More menu', () => {
    render(<Row />)
    expect(screen.getByRole('button', { name: 'Hide Summer sale' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More actions for Summer sale' })).toBeVisible()
  })

  it('hides the other actions until hover, focus inside the row or selection (CSS)', () => {
    expect(body('.actions')).toMatch(/visibility:\s*hidden/)
    for (const selector of ['.box:hover .actions', '.box:focus-within .actions']) {
      expect(body(selector), selector).toMatch(/visibility:\s*visible/)
    }
    expect(body('.selected .actions')).toMatch(/visibility:\s*visible/)
    expect(body('.state')).not.toMatch(/visibility/)
  })

  it('puts the actions next in the tab order once focus is inside the row', async () => {
    render(<Row />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Summer sale' })).toHaveFocus()
    expect(rowBox().matches(':focus-within')).toBe(true)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Rename Summer sale' })).toHaveFocus()
  })

  it('marks the selected row with its class', () => {
    render(<Row selected />)
    expect(rowBox()).toHaveClass(styles.selected)
    expect(body('.selected .name')).toMatch(/font-weight:\s*var\(--weight-bold\)/)
  })
})

describe('ObjectRow: muted, title and events [T3c]', () => {
  it('strikes the name of a muted row and dims the row but not its actions', () => {
    render(<Row muted />)
    expect(rowBox()).toHaveClass(styles.muted)
    expect(body('.muted .name')).toMatch(/text-decoration:\s*line-through/)
    expect(body('.muted .content')).toMatch(/opacity:\s*var\(--opacity-disabled\)/)
    expect(rules.some((r) => /\.muted\s+\.(tail|actions|state)/.test(r.selector))).toBe(false)
  })

  it('puts the title on the row', () => {
    render(<Row title="Projects/Summer sale.adman" />)
    expect(rowBox()).toHaveAttribute('title', 'Projects/Summer sale.adman')
  })

  it('calls onSelect on click, onOpen on double-click and on Enter', async () => {
    const onSelect = vi.fn()
    const onOpen = vi.fn()
    render(<Row onSelect={onSelect} onOpen={onOpen} />)
    const main = screen.getByRole('button', { name: 'Summer sale' })
    await userEvent.click(main)
    expect(onSelect).toHaveBeenCalledTimes(1)
    await userEvent.dblClick(main)
    expect(onOpen).toHaveBeenCalledTimes(1)
    main.focus()
    onSelect.mockClear()
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects on Enter when there is no onOpen', async () => {
    const onSelect = vi.fn()
    render(<Row onSelect={onSelect} />)
    screen.getByRole('button', { name: 'Summer sale' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('passes mainProps to the main button', () => {
    render(<Row mainProps={{ 'aria-current': 'page' }} />)
    expect(screen.getByRole('button', { name: 'Summer sale' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('draws the thumb, the name and the marks', () => {
    render(<Row thumb={<span data-testid="thumb" />} marks={<span>Paid</span>} />)
    expect(screen.getByTestId('thumb')).toBeInTheDocument()
    expect(screen.getByText('Summer sale')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
  })

  it('passes axe, plain, selected and muted', async () => {
    render(
      <main>
        <Row />
        <Row selected meta="Shared" />
        <Row muted />
      </main>,
    )
    expect(await axeViolations()).toEqual([])
  })
})
