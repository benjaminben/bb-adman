// AST-2 (spec/phases/design-wave-screens-b.md, "AST-2"): the shared photo strip. Tiles in order,
// a ✕ on removable tiles, a dashed "+" tile last, a spinner and status while adding, a warn edge
// when a photo is needed. It sends nothing itself: it calls the functions it is given.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhotoStrip, type PhotoStripProps, type StripPhoto } from '@/renderer/ui/photo-strip'
import styles from '@/renderer/ui/photo-strip/photo-strip.module.css'
import { axeViolations } from '../render'

const PHOTOS: StripPhoto[] = [
  {
    id: 'a',
    name: 'tin-front.png',
    src: 'adman-asset://P1/a',
    removable: true,
    removeLabel: 'Remove tin-front.png',
  },
  { id: 'b', name: 'tin-side.png', src: null, removable: true, removeLabel: 'Remove tin-side.png' },
  {
    id: 'c',
    name: 'tin-top.png',
    src: 'adman-asset://P1/c',
    removable: false,
    removeLabel: 'Remove tin-top.png',
  },
]

function strip(props: Partial<PhotoStripProps> = {}) {
  const onRemove = vi.fn()
  const onAdd = vi.fn()
  render(
    <main>
      <PhotoStrip
        label="Photos of Harbour Blend"
        photos={PHOTOS}
        onRemove={onRemove}
        onAdd={onAdd}
        addLabel="Add photos to Harbour Blend"
        adding={false}
        {...props}
      />
    </main>,
  )
  return {
    onRemove,
    onAdd,
    list: screen.getByRole('list', { name: props.label ?? 'Photos of Harbour Blend' }),
  }
}

describe('PhotoStrip [AST-2]', () => {
  it('draws the tiles in order, pictures named by file, and the "+" tile last', () => {
    const { list } = strip()
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(within(items[0]!).getByRole('img', { name: 'tin-front.png' })).toHaveAttribute(
      'src',
      'adman-asset://P1/a',
    )
    expect(within(items[0]!).getByRole('img')).toHaveAttribute('title', 'tin-front.png')
    expect(within(items[2]!).getByRole('img', { name: 'tin-top.png' })).toBeInTheDocument()
    expect(
      within(items[3]!).getByRole('button', { name: 'Add photos to Harbour Blend' }),
    ).toHaveAttribute('title', 'Add photos to Harbour Blend')
  })

  it('draws a missing file as a faded icon that says "File not found" on the tile', () => {
    const { list } = strip()
    const missing = within(list).getAllByRole('listitem')[1]!
    expect(within(missing).queryByRole('img')).toBeNull()
    expect(within(missing).getByTitle('File not found')).toBeInTheDocument()
    expect(within(missing).getByText('File not found')).toBeVisible()
  })

  it('puts a ✕ only on removable tiles, and the ✕ calls onRemove with the id', async () => {
    const { onRemove, list } = strip()
    const removes = within(list).getAllByRole('button', { name: /^Remove / })
    expect(removes.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Remove tin-front.png',
      'Remove tin-side.png',
    ])
    expect(removes[0]).toHaveAttribute('title', 'Remove tin-front.png')
    await userEvent.click(removes[1]!)
    expect(onRemove).toHaveBeenCalledWith('b')
  })

  it('gives each ✕ to removeRef with its id', () => {
    const removeRef = vi.fn()
    strip({ removeRef })
    const tin = screen.getByRole('button', { name: 'Remove tin-front.png' })
    expect(removeRef).toHaveBeenCalledWith('a', tin)
  })

  it('calls onAdd from the "+" tile', async () => {
    const { onAdd } = strip()
    await userEvent.click(screen.getByRole('button', { name: 'Add photos to Harbour Blend' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('disables the "+" tile with a spinner and a status while adding', async () => {
    const { onAdd } = strip({ adding: true, addingLabel: 'Adding photos…' })
    const add = screen.getByRole('button', { name: 'Add photos to Harbour Blend' })
    expect(add).toBeDisabled()
    expect(add.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Adding photos…')
    await userEvent.click(add)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('shows no status when not adding', () => {
    strip({ addingLabel: 'Adding photos…' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('gives the "+" tile the warn edge with needsOne and no photo only', () => {
    strip({ photos: [], needsOne: true, label: 'Photos of Linnea Park' })
    const add = screen.getByRole('button', { name: 'Add photos to Harbour Blend' })
    expect(add).toHaveClass(styles.warn ?? 'missing')
  })

  it('keeps the plain edge with photos, or without needsOne', () => {
    strip({ needsOne: true })
    expect(screen.getByRole('button', { name: 'Add photos to Harbour Blend' })).not.toHaveClass(
      styles.warn ?? 'missing',
    )
  })

  it('draws the marks given for a photo', () => {
    const marked = [{ ...PHOTOS[0]!, marks: <span>Made with AI</span> }]
    strip({ photos: marked })
    expect(screen.getByText('Made with AI')).toBeInTheDocument()
  })

  it('has no accessibility violations, with photos and while adding', async () => {
    strip({ adding: true, addingLabel: 'Adding photos…' })
    expect(await axeViolations()).toEqual([])
  })
})
