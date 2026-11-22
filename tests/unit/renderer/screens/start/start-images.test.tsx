// START-1 (design/audit/spec-start.md "Left half: the image", "Image files"): the ten built
// pictures, decoration only, and a flat panel when the folder is empty.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StartImages, START_IMAGES } from '@/renderer/screens/start/start-images'

describe('StartImages [START-1]', () => {
  it('finds the ten start pictures in its folder', () => {
    expect(START_IMAGES).toHaveLength(10)
    expect(START_IMAGES.every((url) => /start-\d\d\.webp/.test(url))).toBe(true)
  })

  it('shows one picture, hidden from screen readers', () => {
    const { container } = render(<StartImages />)
    const pictures = container.querySelectorAll('img')
    expect(pictures).toHaveLength(1)
    expect(pictures[0]).toHaveAttribute('alt', '')
    expect(pictures[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows a flat panel and no picture when the folder is empty', () => {
    const { container, getByTestId } = render(<StartImages urls={[]} />)
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(getByTestId('start-images')).toBeInTheDocument()
  })
})
