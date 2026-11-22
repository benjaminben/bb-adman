// R2C-3, an orchestrator ruling on the R2C-2 row heads: a row whose name is only its size
// written another way ("1080x1080" over 1080×1080) shows the size once, as "1080×1080". The
// names are compared after turning "x" into "×" and dropping spaces. A real name ("Square feed")
// still shows over the size.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GridHeads } from '@/renderer/screens/campaign/variant-grid/grid-heads'
import gridStyles from '@/renderer/screens/campaign/variant-grid/variant-grid.module.css'

function draw(sizeLabel: string, width: number, height: number) {
  const { container } = render(
    <div>
      <GridHeads rows={[{ sizeLabel, width, height }]} columns={['en']} />
    </div>,
  )
  const head = container.querySelector(`.${gridStyles.rowHead}`)
  return [...(head?.children ?? [])].map((el) => el.textContent)
}

describe('GridHeads row heads [R2C-3 ruling]', () => {
  it.each([
    ['1080x1080', 1080, 1080],
    ['1080×1080', 1080, 1080],
    ['1080 x 1920', 1080, 1920],
    ['1920X1080', 1920, 1080],
  ])('shows the size once for the label "%s"', (label, width, height) => {
    expect(draw(label, width, height)).toEqual([`${width}×${height}`])
  })

  it('shows a real name over the size', () => {
    expect(draw('Square feed', 1080, 1080)).toEqual(['Square feed', '1080×1080'])
  })

  it('shows both when the label names another size', () => {
    expect(draw('1080x1920', 1080, 1080)).toEqual(['1080x1920', '1080×1080'])
  })

  it('keeps the language heads', () => {
    draw('Square feed', 1080, 1080)
    expect(screen.getByText('English')).toBeInTheDocument()
  })
})
