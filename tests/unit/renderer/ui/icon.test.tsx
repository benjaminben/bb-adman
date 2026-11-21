// ST-2 (spec/app-style.md "Icons and drawings"): one 24 by 24 stroke icon by name, from the
// prototype's path set. Icons are decorative: hidden from assistive tech, never a tab stop.
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Icon, ICON_NAMES } from '@/renderer/ui/icon'
import styles from '@/renderer/ui/icon/icon.module.css'
import { axeViolations } from '../render'

describe('Icon [ST-2]', () => {
  it('knows the prototype path set', () => {
    expect(ICON_NAMES).toContain('plus')
    expect(ICON_NAMES).toContain('spinner')
    expect(ICON_NAMES).toContain('unlink')
    expect(ICON_NAMES.length).toBe(46)
  })

  it.each(ICON_NAMES.map((name) => [name]))('%s draws one hidden 24 by 24 svg', (name) => {
    const { container } = render(<Icon name={name} />)
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(1)
    const svg = svgs[0] as SVGSVGElement
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.querySelector('title')).toBeNull()
    expect(svg.hasAttribute('tabindex')).toBe(false)
    expect(svg.children.length).toBeGreaterThan(0)
  })

  it('sets the small class for size="small" and not otherwise', () => {
    const { container } = render(
      <>
        <Icon name="check" size="small" />
        <Icon name="check" />
      </>,
    )
    const [small, normal] = [...container.querySelectorAll('svg')]
    expect(styles.small).toBeTruthy()
    expect(small).toHaveClass(styles.small as string)
    expect(normal).not.toHaveClass(styles.small as string)
  })

  it('adds no tab stop and leaves the button name to its word; axe is clean', async () => {
    const { container, getByRole } = render(
      <button type="button">
        <Icon name="gear" />
        Settings
      </button>,
    )
    expect(getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
    expect(await axeViolations(container)).toEqual([])
  })
})
