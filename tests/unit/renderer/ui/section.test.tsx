// T3a (spec/phases/design-wave.md; spec/app-style-parts.md, "Section"): the one way to title and
// group things. A heading holds the fold button; the body hides when folded; the fold state
// lasts for the window's session (C-8); "›" leads to a SubPage; no box.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Section, type SectionProps } from '@/renderer/ui/section'
import { axeViolations } from '../render'

function draw(props: Partial<SectionProps> & { id: string }) {
  return render(
    <main>
      <Section title="Cloud storage" {...props}>
        <label>
          Bucket <input defaultValue="spring-pictures" />
        </label>
      </Section>
    </main>,
  )
}

const toggle = () => screen.getByRole('button', { name: 'Cloud storage' })
const field = () => screen.getByLabelText('Bucket', { selector: 'input' })

describe('Section [T3a]', () => {
  it('puts the title in a heading at level 3 holding the fold button', () => {
    draw({ id: 'test.level' })
    const heading = screen.getByRole('heading', { level: 3, name: 'Cloud storage' })
    expect(heading).toContainElement(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    const body = document.getElementById(toggle().getAttribute('aria-controls') ?? '')
    expect(body).toContainElement(field())
    expect(screen.getByRole('region', { name: 'Cloud storage' })).toContainElement(body)
  })

  it.each([2, 4] as const)('takes the heading level %i', (level) => {
    draw({ id: `test.level${level}`, level })
    expect(screen.getByRole('heading', { level, name: 'Cloud storage' })).toBeInTheDocument()
  })

  it('folds on a click, hiding the body, and opens on a second click', async () => {
    draw({ id: 'test.click' })
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(field()).not.toBeVisible()
    expect(document.getElementById(toggle().getAttribute('aria-controls') ?? '')).toHaveAttribute(
      'hidden',
    )
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    expect(field()).toBeVisible()
  })

  it('keeps the fold state when drawn again with the same id, and not for a new id', async () => {
    const first = draw({ id: 'test.memory' })
    await userEvent.click(toggle())
    first.unmount()
    const again = draw({ id: 'test.memory' })
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    again.unmount()
    draw({ id: 'test.memory-other' })
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('starts closed with fold "closed"', () => {
    draw({ id: 'test.closed', fold: 'closed' })
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(field()).not.toBeVisible()
  })

  it('draws no button with fold "none"', () => {
    draw({ id: 'test.none', fold: 'none' })
    expect(screen.getByRole('heading', { level: 3, name: 'Cloud storage' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(field()).toBeVisible()
  })

  it('with onOpenPage draws a button with no aria-expanded that opens the page', async () => {
    const onOpenPage = vi.fn()
    draw({ id: 'test.page', onOpenPage })
    expect(toggle()).not.toHaveAttribute('aria-expanded')
    expect(toggle()).not.toHaveAttribute('aria-controls')
    expect(toggle().querySelector('svg')).not.toBeNull()
    await userEvent.click(toggle())
    expect(onOpenPage).toHaveBeenCalledOnce()
  })

  it('makes a button passed as summary its own tab stop after the fold button', async () => {
    const onClick = vi.fn()
    const info = <button type="button">About cloud storage</button>
    const summary = (
      <button type="button" onClick={onClick}>
        Connected
      </button>
    )
    draw({ id: 'test.summary', info, summary })
    await userEvent.tab()
    expect(toggle()).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'About cloud storage' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Connected' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows a plain text summary in the header, outside the button name', () => {
    draw({ id: 'test.text', summary: 'spring-pictures' })
    expect(screen.getByText('spring-pictures')).toBeVisible()
    expect(toggle()).toHaveAccessibleName('Cloud storage')
  })

  it.each([
    ['open', 'open'],
    ['closed', 'closed'],
  ] as const)('passes axe %s', async (_, fold) => {
    draw({ id: `test.axe-${fold}`, fold, summary: 'spring-pictures' })
    expect(await axeViolations()).toEqual([])
  })
})

describe('Section look [T3a]', () => {
  const css = fs
    .readFileSync(path.resolve('src/renderer/ui/section/section.module.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = (name: string) => css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

  it('draws no box: no shadow and no radius', () => {
    expect(css).not.toMatch(/box-shadow/)
    expect(css).not.toMatch(/border-radius/)
  })

  it('sets the title in the section type role, in the body face', () => {
    expect(rule('heading')).toMatch(/font-size:\s*var\(--type-section-size\)/)
    expect(rule('heading')).toMatch(/font-family:\s*var\(--font-body\)/)
  })

  it('draws one hairline under the section', () => {
    expect(rule('section')).toMatch(
      /border-bottom:\s*var\(--border-width\) solid var\(--color-line\)/,
    )
  })
})
