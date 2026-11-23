// CW-6b review: the node type list of the workflow ask. The list shrinks with the window, so in
// the smallest window the risk line and the buttons stay on screen and only the list scrolls;
// each item clips what it draws, so stacked combining marks cannot cover the next type.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(
  path.resolve('src/renderer/app/permission-dialog/workflow-list/workflow-list.module.css'),
  'utf8',
)

function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  if (start < 0) throw new Error(`no rule ${selector}`)
  return css.slice(start, css.indexOf('}', start))
}

describe('the workflow ask list style [CW-6b]', () => {
  it('caps the list height by the window height', () => {
    expect(rule('.list')).toMatch(/max-height: min\(calc\(var\(--space-6\) \* \d+\), \d+vh\)/)
  })

  it('clips each node type to its own item', () => {
    expect(rule('.item')).toContain('overflow: hidden')
  })
})
