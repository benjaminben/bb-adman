// R2-Q fault A: a menu opens fully inside the window. It starts at its button's left edge and
// below it; without room to the right it lines its right edge up with the button's right edge,
// and without room below it opens above. It is never wider than the room on its side.
import fs from 'node:fs'
import path from 'node:path'
import { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { placeMenu, useMenuPlace, type MenuPlace } from '@/renderer/ui/menu-place'

const VIEW = { width: 800, height: 600 }
const MENU = { width: 300, height: 200 }
const GAP = 4
// A 100 by 34 button with its top left corner at (x, y).
const at = (x: number, y: number) => ({ left: x, top: y, right: x + 100, bottom: y + 34 })

describe('placeMenu [R2-Q A]', () => {
  it.each<[string, ReturnType<typeof at>, { width: number; height: number }, MenuPlace]>([
    ['room right and below', at(20, 20), MENU, { inline: 'start', block: 'below', maxWidth: 780 }],
    ['no room right', at(650, 20), MENU, { inline: 'end', block: 'below', maxWidth: 750 }],
    ['just fits right', at(500, 20), MENU, { inline: 'start', block: 'below', maxWidth: 300 }],
    ['no room below', at(20, 500), MENU, { inline: 'start', block: 'above', maxWidth: 780 }],
    [
      'no room right nor below',
      at(650, 500),
      MENU,
      { inline: 'end', block: 'above', maxWidth: 750 },
    ],
    [
      'fits neither side: the side with more room, width held to it',
      at(250, 20),
      { width: 700, height: 200 },
      { inline: 'start', block: 'below', maxWidth: 550 },
    ],
    [
      'fits neither side, more room on the left',
      at(450, 20),
      { width: 700, height: 200 },
      { inline: 'end', block: 'below', maxWidth: 550 },
    ],
    [
      'fits neither above nor below: the side with more room',
      at(20, 200),
      { width: 300, height: 500 },
      { inline: 'start', block: 'below', maxWidth: 780 },
    ],
  ])('%s', (_, trigger, menu, place) => {
    expect(placeMenu(trigger, menu, VIEW, GAP)).toEqual(place)
  })
})

function Harness() {
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const place = useMenuPlace(true, button, menu)
  return (
    <div>
      <button ref={button} type="button">
        Direction
      </button>
      <ul ref={menu} role="menu" aria-label="Direction" {...place} />
    </div>
  )
}

describe('useMenuPlace [R2-Q A]', () => {
  it('measures the button and the menu and marks the menu with its place', () => {
    const rect = (b: ReturnType<typeof at>) => ({ ...b, x: b.left, y: b.top, width: 0, height: 0 })
    const button = HTMLButtonElement.prototype
    const list = HTMLUListElement.prototype
    const real = { button: button.getBoundingClientRect, list: list.getBoundingClientRect }
    button.getBoundingClientRect = () => rect(at(window.innerWidth - 120, 20)) as DOMRect
    list.getBoundingClientRect = () => ({ ...rect(at(0, 0)), width: 300, height: 120 }) as DOMRect
    try {
      render(<Harness />)
      const menu = screen.getByRole('menu')
      expect(menu).toHaveAttribute('data-inline', 'end')
      expect(menu).toHaveAttribute('data-block', 'below')
      expect(menu.style.maxWidth).toBe(`${window.innerWidth - 20}px`)
    } finally {
      button.getBoundingClientRect = real.button
      list.getBoundingClientRect = real.list
    }
  })
})

describe('the placed menu look [R2-Q A]', () => {
  const read = (file: string) => fs.readFileSync(path.resolve('src/renderer/ui', file), 'utf8')
  const css = read('menu-place/menu-place.module.css') + read('layout.module.css')
  it.each([
    ['opens below at the left edge by default', /\.placed \{[^}]*top: 100%;[^}]*left: 0;/],
    ['lines up its right edge on "end"', /\.placed\[data-inline='end'\] \{[^}]*right: 0;/],
    ['opens above on "above"', /\.placed\[data-block='above'\] \{[^}]*bottom: 100%;/],
    ['wraps a long word rather than cutting it', /\.menu \{[^}]*overflow-wrap: anywhere;/],
  ])('%s', (_, rule) => {
    expect(css).toMatch(rule)
  })
})
