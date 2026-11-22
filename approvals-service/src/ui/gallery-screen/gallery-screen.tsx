import type { GalleryView, Signoff, Variant } from '../../visitor/actions'
import { NOTICES, type NoticeKey } from '../../visitor/notices'
import { GalleryGrid } from '../gallery-grid/gallery-grid'
import { GalleryScript } from '../gallery-script/gallery-script'
import { Notice } from '../notice/notice'
import { PageShell } from '../page-shell/page-shell'
import { ReviewerPanel } from '../reviewer-panel/reviewer-panel'
import { VariantCard } from '../variant-card/variant-card'
import styles from './gallery-screen.module.css'

// Shown in the sidebar, by the reviewer form; every other gallery notice heads the main column.
const SIDEBAR_NOTICES: readonly NoticeKey[] = ['bad-email', 'email-saved']

// One variant's sign-offs of its current version, oldest first. The view already holds only
// those; the version check keeps an older one off the page whatever the view holds.
const signoffsOf = (signoffs: Signoff[], variant: Variant) =>
  signoffs
    .filter((s) => s.variantKey === variant.variantKey && s.version === variant.version)
    .sort((a, b) => a.createdAt - b.createdAt)

// spec/phases/round-2-approvals.md "The page": the sidebar, then the notice and the cards, drawn
// from the view alone, one card per variant in gallery order.
export function GalleryScreen({ view }: { view: GalleryView }) {
  const { slug, campaignName } = view.link
  const { reviewer, notice } = view
  const cards = [...view.variants]
    .sort((a, b) => a.position - b.position)
    .map((variant) => {
      const signoffs = signoffsOf(view.signoffs, variant)
      const mine = reviewer !== null && signoffs.some((s) => s.email === reviewer)
      return { variant, signoffs, mine }
    })
  const live = cards.filter((card) => !card.variant.expired)
  const side = (
    <ReviewerPanel
      slug={slug}
      campaignName={campaignName}
      reviewer={reviewer}
      stamp={view.stamp}
      notice={notice}
      left={live.filter((card) => !card.mine).length}
      live={live.length}
    />
  )
  return (
    <PageShell side={side}>
      <title>{campaignName}</title>
      {notice === null || SIDEBAR_NOTICES.includes(notice) ? null : (
        <Notice tone="info">{NOTICES[notice].text}</Notice>
      )}
      {cards.length === 0 ? (
        <p className={styles.empty}>Nothing to review yet.</p>
      ) : (
        <GalleryGrid>
          {cards.map(({ variant, signoffs, mine }) => (
            <VariantCard
              key={variant.variantKey}
              slug={slug}
              variant={variant}
              signoffs={signoffs}
              reviewer={reviewer}
              mine={mine}
            />
          ))}
        </GalleryGrid>
      )}
      <GalleryScript />
    </PageShell>
  )
}
