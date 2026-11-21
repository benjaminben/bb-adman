// spec/approvals-gallery.md "Components": one variant's sign-offs, split into the current
// version's and older versions', each oldest first.
import type { GalleryView } from '../visitor/actions'

export type Signoff = GalleryView['signoffs'][number]
export type Variant = GalleryView['variants'][number]

const oldestFirst = (a: Signoff, b: Signoff) => a.createdAt - b.createdAt

export function groupSignoffs(signoffs: Signoff[], variant: Variant) {
  const own = signoffs.filter((s) => s.variantKey === variant.variantKey)
  return {
    current: own.filter((s) => s.version === variant.version).sort(oldestFirst),
    earlier: own.filter((s) => s.version < variant.version).sort(oldestFirst),
  }
}
