// ST-6 (spec/app-style.md "Icons and drawings"): the start page's three drawings are
// decorative. Hidden from assistive tech, never a tab stop, still with reduce motion.
import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StartDrawings } from '@/renderer/screens/start/start-drawings'
import { axeViolations } from '../render'

const CSS = path.resolve('src/renderer/screens/start/start-drawings/start-drawings.module.css')

describe('start drawings [ST-6]', () => {
  it('draws three hidden svg scenes', () => {
    const { container } = render(<StartDrawings />)
    const svgs = [...container.querySelectorAll('svg')]
    expect(svgs).toHaveLength(3)
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      expect(svg.getAttribute('focusable')).toBe('false')
      expect(svg.children.length).toBeGreaterThan(0)
    }
  })

  it('has no tab stop and no accessible name inside', () => {
    const { container } = render(<StartDrawings />)
    for (const el of container.querySelectorAll('*')) {
      expect(el.hasAttribute('tabindex')).toBe(false)
      expect(el.hasAttribute('aria-label')).toBe(false)
      expect(el.hasAttribute('aria-labelledby')).toBe(false)
      expect(['title', 'desc', 'a', 'button', 'text']).not.toContain(el.tagName.toLowerCase())
    }
  })

  it('holds the reduce-motion rule in its CSS module', () => {
    const css = fs.readFileSync(CSS, 'utf8')
    expect(css.startsWith('/* app-style */')).toBe(true)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{\s*animation: none/)
  })

  it('has no axe violations', async () => {
    render(<StartDrawings />)
    expect(await axeViolations()).toEqual([])
  })
})
