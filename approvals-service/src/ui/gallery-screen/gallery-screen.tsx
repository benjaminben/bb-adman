import type { GalleryView } from '../../visitor/actions'
import { NOTICES } from '../../visitor/notices'
import { GalleryGrid } from '../gallery-grid/gallery-grid'
import { GalleryHeader } from '../gallery-header/gallery-header'
import { groupSignoffs } from '../group-signoffs'
import { Notice } from '../notice/notice'
import { PageShell } from '../page-shell/page-shell'
import { VariantCard } from '../variant-card/variant-card'
import styles from './gallery-screen.module.css'

// The gallery drawn from the view alone, one card per variant in gallery order.
export function GalleryScreen({ view }: { view: GalleryView }) {
  const { slug, campaignName } = view.link
  const variants = [...view.variants].sort((a, b) => a.position - b.position)
  return (
    <PageShell>
      <title>{campaignName}</title>
      <GalleryHeader slug={slug} campaignName={campaignName} />
      {view.notice === null ? null : (
        <Notice tone={view.notice === 'bad-email' ? 'error' : 'info'}>
          {NOTICES[view.notice].text}
        </Notice>
      )}
      {variants.length === 0 ? (
        <p className={styles.empty}>Nothing to review yet.</p>
      ) : (
        <GalleryGrid>
          {variants.map((variant) => (
            <VariantCard
              key={variant.variantKey}
              slug={slug}
              variant={variant}
              {...groupSignoffs(view.signoffs, variant)}
            />
          ))}
        </GalleryGrid>
      )}
    </PageShell>
  )
}
