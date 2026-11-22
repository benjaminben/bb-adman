// The campaign page (SPEC 14 1.41 TP-2): the variants from campaign.get as a grid of tiles
// (S2-16), the picture panel for the chosen one, and its runs. The master is chosen at the start. One job store per
// open page. SPEC 14 1.57 TP-6: the video card sits under the picture panel.
// P3-10 (spec/editor.md, "Variant tabs"): the page is the overview tab and one tab per open
// variant, holding the editor. A plain click on a tile shows the variant's tab; the tile's
// "+" and Cmd-click (Ctrl-click on Windows) open it behind. The variant shown last is the one
// the overview's panels work on (A-47). campaign.get is read again on project.changed and on
// job.updated, so a deleted variant loses its tab and the marks follow the jobs.
// P4-12 (spec/screens-ai.md, "The paid count"): the overview shows the paid count under the name.
// SP-7 (A-120): the reference ticks start as the chosen variant's subject photos.
// P5-14 (spec/screens-variants.md, "The overview"): the overview shows the campaign's Undo and
// Redo, then one grid per direction in place of the one grid.
// P9-13: "Publish…" sits in the header beside "Export…" and "Reports".
// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the head is its own component;
// the overview is the view bar (Variants, Checks, Translations, with Undo and Redo) and the
// shown view. The page keeps the stores and which view shows.
import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useApi, useApp } from '@/renderer/app/app-context'
import { NavScope, useNav } from '@/renderer/app/nav-context'
import { createApprovalsStore } from '@/renderer/stores/approvals-store'
import { createJobStore } from '@/renderer/stores/job-store'
import { OVERVIEW_TAB, campaignNav } from '@/renderer/stores/nav-store'
import { approvalFooter } from '@/renderer/screens/campaign/approval-mark'
import { CampaignHead } from '@/renderer/screens/campaign/campaign-head'
import {
  CampaignOverview,
  type CampaignViewName,
} from '@/renderer/screens/campaign/campaign-overview'
import { VariantTabs } from '@/renderer/screens/campaign/variant-tabs'
import { VariantsTab } from '@/renderer/screens/campaign/variants-tab'
import { PaidCount } from '@/renderer/ui/paid-count'
import layout from '@/renderer/ui/layout.module.css'
import styles from './campaign-view.module.css'
import { useCampaign } from './use-campaign'
import { usePreTick } from './use-pre-tick'

// Loaded when a variant first opens, so the Scene and its fonts load only for the editor.
const Editor = lazy(() => import('@/renderer/editor/editor').then((m) => ({ default: m.Editor })))
const loadingVariant = <p className={layout.muted}>Loading the variant…</p>

type Props = { projectId: string; campaignId: string; onBack: () => void }

function CampaignPage(props: Props) {
  const { projectId, campaignId } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const data = useCampaign(projectId, campaignId)
  const [store] = useState(() => createJobStore({ api, command }, projectId))
  const shown = useNav((s) => campaignNav(s, projectId, campaignId).shown)
  const openVariant = useNav((s) => s.openVariant)
  const keepVariants = useNav((s) => s.keepVariants)
  const [chosenId, setChosenId] = useState<string | null>(null)
  if (shown !== OVERVIEW_TAB && shown !== chosenId) setChosenId(shown)
  // SPEC 14 1.46 TP-5: reference ticks last while the page is open, across variants.
  const [ticks, setTicks] = useState<string[]>([])
  // R2C-1 (A-303): the overview's view is the page's, kept while a variant tab is shown.
  const [view, setView] = useState<CampaignViewName>('variants')
  const variants = data?.variants
  const variant = variants?.find((v) => v.id === chosenId) ?? variants?.[0]
  const variantId = variant?.id ?? null
  const preTick = usePreTick(variant, setTicks)

  // AP-11: the approvals store, one per page; its timer stops when the page closes.
  const [approvals] = useState(() => createApprovalsStore(api, projectId, campaignId))
  useEffect(() => approvals.getState().start(), [approvals])
  const approvalsData = useStore(approvals, (s) => s.data)
  useEffect(() => store.getState().subscribe(), [store])
  useEffect(() => {
    if (variantId !== null) void store.getState().load(variantId)
  }, [store, variantId])
  useEffect(() => {
    if (variants)
      keepVariants(
        projectId,
        campaignId,
        variants.map((v) => v.id),
      )
  }, [keepVariants, projectId, campaignId, variants])

  const overview = data && (
    <CampaignOverview
      projectId={projectId}
      campaignId={campaignId}
      data={data}
      view={view}
      onView={setView}
      variants={
        <VariantsTab
          projectId={projectId}
          campaignId={campaignId}
          data={data}
          variant={variant}
          store={store}
          ticks={ticks}
          setTicks={setTicks}
          preTick={preTick}
          onChoose={(id) => openVariant(projectId, campaignId, id)}
          onOpenBehind={(id) => openVariant(projectId, campaignId, id, true)}
          tileFooter={approvalFooter(approvalsData)}
        />
      }
    />
  )

  return (
    <section className={styles.page} aria-label="Campaign">
      <CampaignHead
        projectId={projectId}
        campaignId={campaignId}
        data={data}
        approvals={approvals}
        onBack={props.onBack}
      />
      {shown === OVERVIEW_TAB && <PaidCount projectId={projectId} campaignId={campaignId} />}
      {data === null ? (
        <p className={layout.muted}>Loading the campaign…</p>
      ) : (
        <VariantTabs
          projectId={projectId}
          campaignId={campaignId}
          variants={data.variants}
          overview={overview}
          renderVariant={(id, view, onView) => (
            <Suspense fallback={loadingVariant}>
              <Editor key={id} projectId={projectId} variantId={id} view={view} onView={onView} />
            </Suspense>
          )}
        />
      )}
    </section>
  )
}

export function CampaignView(props: Props) {
  return (
    <NavScope>
      <CampaignPage {...props} />
    </NavScope>
  )
}
