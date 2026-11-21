import { describe, it, expect } from 'vitest'
import { renderPageAddress } from '@/main/render/render-page'

const builtPage = 'file:///app/out/renderer/render.html'

// spec/scene.md "Life of the window": the same rule as pageAddress, with /render.html.
describe('renderPageAddress [spec/scene.md, P3-6]', () => {
  it.each([
    [false, 'http://localhost:5173', 'http://localhost:5173/render.html'],
    [false, 'http://localhost:5173/', 'http://localhost:5173/render.html'],
    [true, 'http://localhost:5173', builtPage],
    [false, undefined, builtPage],
    [false, 'http://localhost:5173/x', builtPage],
    [false, 'http://localhost:5173/?a=1', builtPage],
    [false, 'http://user@localhost:5173', builtPage],
    [false, 'http://evil.example:5173', builtPage],
    [false, 'https://localhost:5173', builtPage],
    [false, 'file:///etc/passwd', builtPage],
  ])('packaged %s with %s gives %s', (isPackaged, rendererUrl, expected) => {
    expect(renderPageAddress({ isPackaged, rendererUrl, builtPage })).toBe(expected)
  })
})
