// ST-8 (spec/app-style.md "Component by component", "Editor", properties panel): the text
// layer's cases, moved word for word from properties-style.test.tsx by ED-1b so ED-2 owns them.
// Copy is set in the reading face, swatches have control edges and alignment is a segmented
// group. Names and pressed states stay as they are.
import fs from 'node:fs'
import path from 'node:path'
import { render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TextFields } from '@/renderer/editor/text-fields'
import { EditorKeyRoot } from '@/renderer/editor/use-editor-key'
import layout from '@/renderer/ui/layout.module.css'
import { HEADLINE } from './editor-fixture'

const EDITOR = path.resolve('src/renderer/editor')
const read = (file: string) => fs.readFileSync(path.join(EDITOR, file), 'utf8')
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// The declarations of the first rule whose selector list is exactly `selector`.
function rule(css: string, selector: string): string {
  for (const m of bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    if (sel === selector) return m[2] ?? ''
  }
  return ''
}

function TextHarness() {
  const root = useRef<HTMLElement>(null)
  return (
    <EditorKeyRoot.Provider value={root}>
      <main ref={root}>
        <TextFields
          layer={HEADLINE}
          palette={['#FFFFFF']}
          font={<p>Font slot</p>}
          onUpdate={vi.fn(async () => null)}
        />
      </main>
    </EditorKeyRoot.Provider>
  )
}

describe('the properties panel takes the look, text layer [ST-8]', () => {
  it.each([['text-fields/text-fields.module.css']])('%s gives swatches control edges', (file) => {
    expect(rule(read(file), '.swatch')).toMatch(
      /border:\s*var\(--border-width\) solid var\(--color-control-border\)/,
    )
  })

  it('sets the copy in the reading face and alignment as a segmented group', () => {
    render(<TextHarness />)
    expect(layout.reading).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Copy' })).toHaveClass(layout.reading as string)
    expect(screen.getByRole('group', { name: 'Align' })).toHaveClass(layout.seg as string)
    expect(screen.getByRole('button', { name: 'Left' })).toHaveAttribute('aria-pressed')
  })
})
