// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1", orchestrator's ruling): the photo strip
// takes an optional size. "regular" (the default) keeps the tiles as AST-2 built them; "small"
// draws them at --option-thumb, so a narrow panel fits more than two a row.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhotoStrip, type PhotoStripProps } from '@/renderer/ui/photo-strip'
import styles from '@/renderer/ui/photo-strip/photo-strip.module.css'

function strip(size?: PhotoStripProps['size']) {
  render(
    <PhotoStrip
      label="Photos of Tin of Tea"
      photos={[
        { id: 'a', name: 'tin.png', src: 'adman-asset://P1/a', removable: true, removeLabel: 'x' },
      ]}
      onRemove={() => {}}
      onAdd={() => {}}
      addLabel="Add photos to Tin of Tea"
      adding={false}
      size={size}
    />,
  )
  return screen.getByRole('list', { name: 'Photos of Tin of Tea' })
}

describe('PhotoStrip size [AST-1]', () => {
  it('draws regular tiles by default', () => {
    expect(strip()).not.toHaveClass(styles.small ?? 'missing')
  })

  it('draws regular tiles when asked', () => {
    expect(strip('regular')).not.toHaveClass(styles.small ?? 'missing')
  })

  it('draws small tiles when asked', () => {
    expect(strip('small')).toHaveClass(styles.small ?? 'missing')
  })
})
