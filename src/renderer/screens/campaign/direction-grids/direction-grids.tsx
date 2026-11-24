// spec/screens-variants.md, "The overview": one section per direction, in directions order,
// labelled by its level-3 heading, then its header (direction-header/) and a grid "Variants in
// {name}" in direction-order.ts order (A-144). CAMP-2: each direction is a Section look with no
// fold and no card; an empty one shows "No variants". A plain click on a tile selects it;
// a Cmd-click (Ctrl-click on Windows) opens it behind, like the tile's "+" (P3-10).
// R2C-3 (design addition 3): a double-click or Enter opens it (onOpen). A Cmd-double-click has
// already opened it behind by its clicks, so it opens nothing more. A key press forgets the last
// Cmd-click, so an arrow only selects.
// P5-15: the tiles' quick look (through every variant, in the grids' order) and delete
// warning are held here, one of each for the whole campaign. MV-6: so is the Make variants
// dialog a tile's "Make variants from this one…" opens.
// Design wave CAMP-1 (C-11): each direction gives its tiles their marks' targets
// (TileTargetsContext): onView shows Checks or Translations, the Activity panel opens through
// its store, and one relink dialog serves the campaign. A tile's title shows only when titles
// differ within its direction (OI-DW-3). CAMP-2: the direction holds its sync review's
// opening, so the tiles' "Out of date" marks open the same review as "Sync {n}".
import { useCallback, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { DeleteVariant } from '@/renderer/dialogs/delete-variant'
import { MakeFromVariant } from '@/renderer/dialogs/fan-out'
import { QuickLook } from '@/renderer/dialogs/quick-look'
import { RelinkDialog } from '@/renderer/dialogs/relink-dialog'
import { outOfDateCount, useSyncOpen } from '@/renderer/dialogs/sync-review'
import { platform } from '@/renderer/editor/use-editor-key'
import { DirectionHeader } from '@/renderer/screens/campaign/direction-header'
import { VariantGrid } from '@/renderer/screens/campaign/variant-grid'
import { TileTargetsContext, type TileView } from '@/renderer/screens/campaign/variant-tile'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { EmptyState } from '@/renderer/ui/empty-state'
import { directionOrder } from './direction-order'
import styles from './direction-grids.module.css'
import { useOpenActivity } from './use-open-activity'

export type DirectionGridsProps = {
  projectId: string
  campaign: CampaignGet
  chosenId: string | null
  onChoose: (variantId: string) => void
  onOpen?: (variantId: string) => void
  onOpenBehind: (variantId: string) => void
  // AP-12: drawn under each tile (the approval marks).
  tileFooter?: (variant: VariantSummary) => ReactNode
  // CAMP-1: where the tiles' Checks and Translations marks lead.
  onView?: (view: TileView) => void
}

type SectionProps = DirectionGridsProps & {
  direction: DirectionRow
  first: boolean
  onQuickLook: (variantId: string) => void
  onDelete: (variantId: string) => void
  onMakeFrom: (variantId: string) => void
  onActivity?: () => void
  onRelink: () => void
}

const opensBehind = (event: MouseEvent) => (platform === 'mac' ? event.metaKey : event.ctrlKey)

const ordered = (campaign: CampaignGet, direction: DirectionRow) =>
  directionOrder(
    campaign.variants.filter((v) => v.directionId === direction.id),
    campaign.campaign,
    direction.masterVariantId,
  )

function DirectionSection(props: SectionProps) {
  const { campaign, direction } = props
  const headingId = useId()
  const behind = useRef(false)
  const variants = ordered(campaign, direction)
  const sync = useSyncOpen()
  const controls = { projectId: props.projectId, campaign, direction }
  const targets = {
    showTitle: new Set(variants.map((v) => v.title)).size > 1,
    onView: props.onView,
    onActivity: props.onActivity,
    onRelink: props.onRelink,
    onSync: outOfDateCount(controls) > 0 ? sync.show : undefined,
  }
  return (
    <section aria-labelledby={headingId} className={styles.direction}>
      <DirectionHeader
        {...controls}
        headingId={headingId}
        count={variants.length}
        first={props.first}
        sync={sync}
      />
      {variants.length === 0 ? (
        <EmptyState icon="grid" words="No variants" />
      ) : (
        <div
          onClickCapture={(event) => {
            behind.current = opensBehind(event)
          }}
          onKeyDownCapture={() => {
            behind.current = false
          }}
        >
          <TileTargetsContext.Provider value={targets}>
            <VariantGrid
              projectId={props.projectId}
              label={`Variants in ${direction.name}`}
              variants={variants}
              chosenId={props.chosenId}
              onChoose={(id) => (behind.current ? props.onOpenBehind(id) : props.onChoose(id))}
              onOpen={(id) => {
                if (!behind.current) props.onOpen?.(id)
              }}
              onOpenBehind={props.onOpenBehind}
              onQuickLook={props.onQuickLook}
              onMakeFrom={props.onMakeFrom}
              onDelete={props.onDelete}
              tileFooter={props.tileFooter}
            />
          </TileTargetsContext.Provider>
        </div>
      )}
    </section>
  )
}

export function DirectionGrids(props: DirectionGridsProps) {
  const { campaign } = props
  const [lookId, setLookId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [makeFromId, setMakeFromId] = useState<string | null>(null)
  const [relink, setRelink] = useState(false)
  const onActivity = useOpenActivity()
  const closeLook = useCallback(() => setLookId(null), [])
  const all = campaign.directions.flatMap((direction) => ordered(campaign, direction))
  return (
    <>
      {campaign.directions.map((direction, i) => (
        <DirectionSection
          key={direction.id}
          {...props}
          direction={direction}
          first={i === 0}
          onQuickLook={setLookId}
          onDelete={setDeleteId}
          onMakeFrom={setMakeFromId}
          onActivity={onActivity}
          onRelink={() => setRelink(true)}
        />
      ))}
      <QuickLook projectId={props.projectId} variants={all} startId={lookId} onClose={closeLook} />
      <DeleteVariant
        projectId={props.projectId}
        variant={all.find((v) => v.id === deleteId) ?? null}
        onClose={() => setDeleteId(null)}
      />
      <MakeFromVariant
        projectId={props.projectId}
        campaign={campaign}
        variantId={makeFromId}
        onClose={() => setMakeFromId(null)}
      />
      <RelinkDialog projectId={props.projectId} open={relink} onClose={() => setRelink(false)} />
    </>
  )
}
