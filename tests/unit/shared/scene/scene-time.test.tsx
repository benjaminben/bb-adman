// P7-7: the Scene draws a video variant's layers at timeMs (phase-07.md "Presets", A-188).
// An image variant is drawn at its full state whatever the time.
import './fake-fonts'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Scene } from '@/shared/scene/scene'
import type { SceneProps } from '@/shared/scene/types'
import type { AnimationBlock } from '@/shared/schemas/layer'
import { layer, variant } from './fixtures'

const video = { ...variant, format: 'video' as const, durationMs: 4000 }
const still: AnimationBlock = { preset: 'none', startMs: 0, durationMs: 0 }
const entering = (preset: AnimationBlock['preset']) => ({
  entrance: { preset, startMs: 1000, durationMs: 1000 },
  exit: still,
})

function draw(over: Partial<SceneProps>) {
  const props: SceneProps = { variant: video, layers: [], assets: {}, timeMs: 0, mode: 'full' }
  const { container } = render(<Scene {...props} {...over} />)
  return container.firstElementChild as HTMLElement
}

const boxOf = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-layer-id="${id}"]`) as HTMLElement

describe('Scene at a time [P7-7]', () => {
  it('draws a layer outside its time hidden, so its text can still be measured', () => {
    const late = layer({ id: 't', type: 'text', timing: { startMs: 2000, endMs: null } })
    const picture = layer({ id: 'p', type: 'image', timing: { startMs: 0, endMs: 500 } })
    const root = draw({ layers: [late, picture], timeMs: 1000 })
    expect(boxOf(root, 't').style.visibility).toBe('hidden')
    expect(boxOf(root, 't').textContent).toBe('Hello')
    expect(boxOf(root, 'p').style.visibility).toBe('hidden')
  })

  it('draws a layer inside its time as before', () => {
    const t = layer({ id: 't', type: 'text', timing: { startMs: 0, endMs: 3000 } })
    expect(boxOf(draw({ layers: [t], timeMs: 1000 }), 't').style.visibility).toBe('')
  })

  it('moves and fades a text box with its preset, keeping its rotation', () => {
    const geometry = { x: 10, y: 20, width: 300, height: 100, rotation: 5, crop: null }
    const t = layer({ id: 't', type: 'text', geometry, animation: entering('fade-up') })
    const box = boxOf(draw({ layers: [t], timeMs: 1500 }), 't')
    expect(Number(box.style.opacity)).toBeCloseTo(0.875, 6)
    // (1 - 0.875) x 5 % of 1350 pixels.
    expect(box.style.transform).toBe('translate(0px, 8.4375px) rotate(5deg)')
  })

  it('draws each word of a stagger-words layer as its own span, white space kept', () => {
    const t = layer({
      id: 't',
      type: 'text',
      copy: 'One  two three',
      animation: entering('stagger-words'),
    })
    const box = boxOf(draw({ layers: [t], timeMs: 1500 }), 't')
    const spans = [...box.querySelectorAll('span')]
    expect(spans.map((s) => s.textContent)).toEqual(['One', 'two', 'three'])
    expect(box.textContent).toBe('One  two three')
    expect(spans.map((s) => s.style.position)).toEqual(['relative', 'relative', 'relative'])
    expect(spans.map((s) => Number(s.style.opacity))).toEqual([1, 0.875, 0])
    expect(box.style.opacity).toBe('')
  })

  it('does not animate a picture layer', () => {
    const p = layer({ id: 'p', type: 'image', animation: entering('fade') })
    expect(boxOf(draw({ layers: [p], timeMs: 1000 }), 'p').style.opacity).toBe('1')
  })

  it('draws an image variant at its full state whatever the time [A-188]', () => {
    const t = layer({
      id: 't',
      type: 'text',
      timing: { startMs: 2000, endMs: 3000 },
      animation: entering('stagger-words'),
    })
    const box = boxOf(draw({ variant, layers: [t], timeMs: 1500 }), 't')
    expect(box.style.visibility).toBe('')
    expect(box.style.opacity).toBe('')
    expect(box.style.transform).toBe('rotate(0deg)')
    expect(box.querySelector('span')).toBeNull()
  })
})
