// A menu opened inside a box that cuts its content off (a dialog's scrolling body) stays inside
// that box, not only inside the window: without room to the right in the box it lines its right
// edge up with its button's right edge.
import { useRef } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clipBox, useMenuPlace } from '@/renderer/ui/menu-place'

const VIEW = { width: 1200, height: 800 }
type Box = { left: number; top: number; right: number; bottom: number }
const rect = (b: Box) =>
  ({ ...b, x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top }) as DOMRect

const real = Element.prototype.getBoundingClientRect
// Each element answers with the box named by its data-box attribute.
function measureFrom(boxes: Record<string, Box>) {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const name = this.getAttribute('data-box')
    return rect((name && boxes[name]) || { left: 0, top: 0, right: 0, bottom: 0 })
  }
}
afterEach(() => {
  Element.prototype.getBoundingClientRect = real
})

function inside(html: string): Element {
  document.body.innerHTML = html
  return document.querySelector('[data-box="button"]')!
}

describe('clipBox', () => {
  it('is the window when no box around the button cuts its content off', () => {
    measureFrom({})
    const button = inside('<div><button data-box="button"></button></div>')
    expect(clipBox(button, VIEW)).toEqual({ left: 0, top: 0, right: 1200, bottom: 800 })
  })

  it('is the scrolling box around the button', () => {
    measureFrom({ body: { left: 300, top: 100, right: 900, bottom: 600 } })
    const button = inside(
      '<div data-box="body" style="overflow-y: auto"><p><button data-box="button"></button></p></div>',
    )
    expect(clipBox(button, VIEW)).toEqual({ left: 300, top: 100, right: 900, bottom: 600 })
  })

  it('is the part shared by every such box and the window', () => {
    measureFrom({
      frame: { left: 200, top: -50, right: 1000, bottom: 700 },
      body: { left: 220, top: 80, right: 1300, bottom: 650 },
    })
    const button = inside(
      '<div data-box="frame" style="overflow: hidden"><div data-box="body" style="overflow: auto">' +
        '<button data-box="button"></button></div></div>',
    )
    expect(clipBox(button, VIEW)).toEqual({ left: 220, top: 80, right: 1000, bottom: 650 })
  })
})

function Harness() {
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const place = useMenuPlace(true, button, menu)
  return (
    <div data-box="body" style={{ overflowY: 'auto' }}>
      <button ref={button} type="button" data-box="button">
        More
      </button>
      <ul ref={menu} role="menu" aria-label="More" data-box="menu" {...place} />
    </div>
  )
}

describe('useMenuPlace inside a box that cuts its content off', () => {
  it('opens toward the inside of the box, though the window has room', () => {
    // The button sits 40 from the box's right edge; the window goes on 500 past it.
    measureFrom({
      body: { left: 300, top: 100, right: 700, bottom: 600 },
      button: { left: 632, top: 150, right: 660, bottom: 178 },
      menu: { left: 0, top: 0, right: 130, bottom: 36 },
    })
    render(<Harness />)
    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('data-inline', 'end')
    expect(menu).toHaveAttribute('data-block', 'below')
    expect(menu.style.maxWidth).toBe('360px')
  })

  it('opens above when the box has no room below the button', () => {
    measureFrom({
      body: { left: 300, top: 100, right: 700, bottom: 200 },
      button: { left: 320, top: 168, right: 348, bottom: 196 },
      menu: { left: 0, top: 0, right: 130, bottom: 36 },
    })
    render(<Harness />)
    expect(screen.getByRole('menu')).toHaveAttribute('data-block', 'above')
  })
})
