// D10: the app mark is one SVG drawn in the app's two colours, with no words and nothing
// it could fetch or run.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const svg = fs.readFileSync('src/renderer/ui/app-mark/app-mark.svg', 'utf8')
// The SVG namespace is a name, not an address that is fetched; everything else is checked.
const body = svg.replace(' xmlns="http://www.w3.org/2000/svg"', '')
const tokens = fs.readFileSync('src/renderer/ui/tokens.css', 'utf8')

function token(name: string): string {
  const found = new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(tokens)
  if (!found) throw new Error(`${name} is not in tokens.css`)
  return found[1].toLowerCase()
}

describe('app mark [D10]', () => {
  it('uses exactly the text and accent colours from tokens.css', () => {
    const colours = new Set((svg.match(/#[0-9a-f]{3,8}\b/gi) ?? []).map((c) => c.toLowerCase()))
    expect([...colours].sort()).toEqual([token('--color-accent'), token('--color-text')].sort())
  })

  it('names no colour in any other way', () => {
    expect(svg).not.toMatch(/rgb|hsl|currentColor|Gradient|<pattern|<filter/i)
  })

  it.each([
    ['text', /<text|<tspan/i],
    ['a script or event handler', /<script|\son\w+\s*=/i],
    ['a link or reference', /href|url\(|https?:|<image|<use|<foreignObject|@import/i],
  ])('holds no %s', (_kind, pattern) => {
    expect(body).not.toMatch(pattern)
  })

  it('is drawn on a 1024 square', () => {
    expect(svg).toMatch(/viewBox="0 0 1024 1024"/)
  })
})
