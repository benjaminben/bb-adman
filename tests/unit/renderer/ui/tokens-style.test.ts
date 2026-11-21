// ST-1 (spec/app-style.md "The token set"): tokens.css holds the prototype's values, so the
// whole app takes the look at once.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve('src/renderer/ui/tokens.css'), 'utf8')
const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
const rootBlock = text.slice(0, text.indexOf('@media'))

function value(name: string): string | undefined {
  const match = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`))
  return match?.[1]?.trim()
}

const COLOURS = [
  '--color-bg',
  '--color-surface',
  '--color-border',
  '--color-text',
  '--color-text-muted',
  '--color-accent',
  '--color-accent-text',
  '--color-danger-bg',
  '--color-danger-text',
  '--color-focus',
  '--color-overlay',
  '--canvas-backdrop',
  '--selection-dark',
  '--selection-light',
  '--guide-color',
  '--color-page',
  '--color-surface-soft',
  '--color-line',
  '--color-control-border',
  '--color-text-secondary',
  '--color-accent-hover',
  '--color-accent-soft',
  '--color-accent-ink',
  '--color-warn-bg',
  '--color-warn-text',
  '--color-info-bg',
  '--color-info-text',
  '--color-ok-bg',
  '--color-ok-text',
  '--color-on-picture',
  '--color-hover-on-dark',
]

const TYPE = [
  '--font-body',
  '--font-serif',
  '--font-title',
  '--font-reading',
  '--font-condensed',
  '--font-mono',
  '--font-size-small',
  '--font-size-control',
  '--font-size-body',
  '--font-size-reading',
  '--font-size-heading',
  '--font-size-title',
  '--font-size-page',
  '--font-size-wordmark',
  '--weight-regular',
  '--weight-medium',
  '--weight-bold',
  '--weight-title',
  '--weight-wordmark',
  '--leading-body',
  '--leading-tight',
  '--tracking-title',
  '--tracking-label',
]

const SPACE_AND_LINES = [
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-6',
  '--space-8',
  '--space-12',
  '--radius',
  '--radius-md',
  '--radius-lg',
  '--radius-pill',
  '--radius-inner',
  '--border-width',
  '--focus-ring-width',
  '--focus-ring-offset',
  '--indicator-width',
  '--indicator-width-thin',
  '--shadow-1',
  '--shadow-2',
  '--shadow-3',
]

const SIZES_AND_MOTION = [
  '--control-height',
  '--control-height-small',
  '--control-height-large',
  '--bar-height',
  '--tab-height',
  '--tab-row-height',
  '--row-height',
  '--icon-size',
  '--icon-size-small',
  '--icon-stroke',
  '--check-size',
  '--switch-width',
  '--switch-height',
  '--switch-knob',
  '--badge-height',
  '--chip-height',
  '--progress-height',
  '--width-dialog',
  '--width-dialog-wide',
  '--width-dialog-large',
  '--width-menu',
  '--width-wide',
  '--width-start-art',
  '--drawing-height',
  '--drawing-stroke',
  '--motion-fast',
  '--motion-spin',
  '--motion-pop',
  '--motion-calm',
  '--ease-calm',
]

describe('the token set [ST-1]', () => {
  it.each([...COLOURS, ...TYPE, ...SPACE_AND_LINES, ...SIZES_AND_MOTION])(
    '%s is defined in :root',
    (name) => {
      expect(value(name)).toBeTruthy()
    },
  )

  it.each([
    ['--color-accent', '#cf1470'],
    ['--color-page', '#f7f4ec'],
    ['--color-control-border', '#8a857b'],
    ['--weight-bold', '650'],
    ['--space-8', '32px'],
    ['--radius-lg', '14px'],
    ['--motion-calm', '16s'],
  ])('%s is %s', (name, expected) => {
    expect(value(name)).toBe(expected)
  })

  it("--font-serif starts with 'Iowan Old Style'", () => {
    expect(value('--font-serif')).toMatch(/^'Iowan Old Style',/)
  })

  it('sets --motion-fast to 0ms when the system asks for reduced motion', () => {
    const reduce = text.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{([^}]*)\}/,
    )
    expect(reduce?.[1]).toMatch(/--motion-fast:\s*0ms;?/)
  })
})
