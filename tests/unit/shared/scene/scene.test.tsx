import './fake-fonts'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Scene } from '@/shared/scene/scene'
import type { SceneProps } from '@/shared/scene/types'
import { asset, layer, variant } from './fixtures'

const background = layer({ id: 'bg', type: 'background', z: 0, source: { assetId: 'A1' } })

function draw(over: Partial<SceneProps> = {}) {
  const props: SceneProps = {
    variant,
    layers: [background],
    assets: { A1: asset() },
    timeMs: 0,
    mode: 'full',
    ...over,
  }
  const { container } = render(<Scene {...props} />)
  return container.firstElementChild as HTMLElement
}

describe('Scene root [FR-090]', () => {
  it('is the variant size, cuts off what lies outside, is black and carries the language', () => {
    const root = draw()
    expect(root.style.width).toBe('1080px')
    expect(root.style.height).toBe('1350px')
    expect(root.style.position).toBe('relative')
    expect(root.style.overflow).toBe('hidden')
    expect(root.style.backgroundColor).toBe('rgb(0, 0, 0)')
    expect(root.getAttribute('lang')).toBe('ja-JP')
  })

  it('overlay-only leaves out the background layer and the black', () => {
    const root = draw({
      mode: 'overlay-only',
      layers: [background, layer({ id: 't', type: 'text' })],
    })
    expect(root.style.backgroundColor).toBe('transparent')
    expect(root.querySelector('img')).toBeNull()
    expect(root.children).toHaveLength(1)
  })
})

describe('Scene layers', () => {
  it('draws layers by z, lowest first, and equal z by ID', () => {
    const root = draw({
      layers: [
        layer({ id: 'c', type: 'text', z: 2 }),
        layer({ id: 'b', type: 'text', z: 1 }),
        background,
        layer({ id: 'a', type: 'text', z: 1 }),
      ],
    })
    const ids = [...root.children].map((child) => child.getAttribute('data-layer-id'))
    expect(ids).toEqual(['bg', 'a', 'b', 'c'])
  })

  it('places each box from its geometry and turns it about its centre', () => {
    const geometry = { x: -5, y: 20, width: 300, height: 100, rotation: 15, crop: null }
    const box = draw({ layers: [layer({ id: 't', type: 'text', geometry })] })
      .firstElementChild as HTMLElement
    expect(box.style.position).toBe('absolute')
    expect([box.style.left, box.style.top, box.style.width, box.style.height]).toEqual([
      '-5px',
      '20px',
      '300px',
      '100px',
    ])
    expect(box.style.transform).toBe('rotate(15deg)')
    expect(box.style.transformOrigin).toBe('50% 50%')
  })

  it('draws a hidden layer with visibility: hidden, keeping its place', () => {
    const box = draw({ layers: [layer({ id: 't', type: 'text', visible: false })] })
      .firstElementChild as HTMLElement
    expect(box.style.visibility).toBe('hidden')
    expect(box.textContent).toBe('Hello')
  })

  it('shows copy holding markup as the characters, never as HTML', () => {
    const box = draw({ layers: [layer({ id: 't', type: 'text', copy: '<b>Big</b> & bold' })] })
      .firstElementChild as HTMLElement
    expect(box.textContent).toBe('<b>Big</b> & bold')
    expect(box.querySelector('b')).toBeNull()
    expect(box.style.letterSpacing).toBe('0.05em')
  })
})

describe('Scene pictures [FR-245]', () => {
  it.each([
    { name: 'an empty picture layer', source: null, assets: { A1: asset() } },
    { name: 'an asset not in assets', source: { assetId: 'A9' }, assets: { A1: asset() } },
    {
      name: 'a missing asset',
      source: { assetId: 'A1' },
      assets: { A1: asset({ missing: true }) },
    },
    { name: 'a font asset', source: { assetId: 'A1' }, assets: { A1: asset({ kind: 'font' }) } },
  ])('draws no <img> for $name', ({ source, assets }) => {
    const root = draw({ layers: [layer({ id: 'i', type: 'image', source })], assets })
    expect(root.querySelector('img')).toBeNull()
  })

  it('keeps the picture hidden until its size is known, then places it and keeps transparency', () => {
    const root = draw({
      layers: [
        layer({ id: 'i', type: 'image', source: { assetId: 'A1' }, style: { opacity: 0.5 } }),
      ],
    })
    const box = root.firstElementChild as HTMLElement
    const img = root.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('src')).toBe('adman-asset://p1/a1')
    expect(img.draggable).toBe(false)
    expect(img.style.visibility).toBe('hidden')
    Object.defineProperty(img, 'naturalWidth', { value: 600 })
    Object.defineProperty(img, 'naturalHeight', { value: 100 })
    fireEvent.load(img)
    expect(img.style.visibility).toBe('')
    expect([img.style.left, img.style.top, img.style.width, img.style.height]).toEqual([
      '0px',
      '25px',
      '300px',
      '50px',
    ])
    expect(box.style.overflow).toBe('hidden')
    expect(box.style.opacity).toBe('0.5')
    expect(box.style.background + img.style.background).toBe('')
  })

  it('draws nothing when the picture fails to load', () => {
    const root = draw()
    fireEvent.error(root.querySelector('img') as HTMLImageElement)
    expect(root.querySelector('img')).toBeNull()
  })
})

describe('Scene settling [FR-098]', () => {
  it('reports one overflow entry per text layer, hidden ones included', async () => {
    const onSettled = vi.fn()
    draw({
      onSettled,
      layers: [
        background,
        layer({ id: 't1', type: 'text' }),
        layer({ id: 't2', type: 'text', visible: false, copy: '' }),
      ],
    })
    await waitFor(() =>
      expect(onSettled).toHaveBeenCalledWith({ overflow: { t1: false, t2: false } }),
    )
  })
})
