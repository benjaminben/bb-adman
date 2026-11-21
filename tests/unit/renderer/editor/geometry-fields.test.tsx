// spec/editor.md, "Properties panel", "Position and size": X, Y, W, H (px) and Rotation (°) on
// every layer, the keyboard path for every canvas action [REQ: 8.6]. Each saves one layer.update.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GeometryFields } from '@/renderer/editor/geometry-fields'
import { axeViolations } from '../render'

const GEOMETRY = { x: 90, y: 120, width: 900, height: 200, rotation: 0, crop: null }

function setup(disabled = false) {
  const onUpdate = vi.fn(async () => null)
  render(
    <main>
      <GeometryFields geometry={GEOMETRY} disabled={disabled} onUpdate={onUpdate} />
    </main>,
  )
  return { onUpdate }
}

describe('GeometryFields [spec/editor.md "Position and size"]', () => {
  it.each([
    ['X', '-40', { x: -40 }],
    ['Y', '300', { y: 300 }],
    ['Width', '640', { width: 640 }],
    ['Height', '0', { height: 1 }],
    ['Rotation', '12.4', { rotation: 12 }],
  ])('%s sends one layer.update with its geometry field', async (name, typed, geometry) => {
    const { onUpdate } = setup()
    const field = screen.getByRole('spinbutton', { name })
    await userEvent.clear(field)
    await userEvent.type(field, `${typed}{Enter}`)
    expect(onUpdate.mock.calls).toEqual([[{ geometry }]])
  })

  it('shows the stored values with W and H as short labels', () => {
    setup()
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toHaveValue('900')
    expect(screen.getByText('W')).toBeInTheDocument()
    expect(screen.getByText('°')).toBeInTheDocument()
  })

  it('disables every field for a locked layer', () => {
    setup(true)
    for (const field of screen.getAllByRole('spinbutton')) expect(field).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    setup()
    expect(await axeViolations()).toEqual([])
  })
})
