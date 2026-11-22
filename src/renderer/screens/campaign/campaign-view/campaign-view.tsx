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
import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useApi, useApp } from '@/renderer/app/app-context'
import { NavScope, useNav } from '@/renderer/app/nav-context'
import { createApprovalsStore } from '@/renderer/stores/approvals-store'
import { createJobStore } from '@/renderer/stores/job-store'
import { OVERVIEW_TAB, campaignNav } from '@/renderer/stores/nav-store'
import { ApprovalBar } from '@/renderer/screens/campaign/approval-bar'
import { approvalFooter } from '@/renderer/screens/campaign/approval-mark'
import { CampaignSections } from '@/renderer/screens/campaign/campaign-sections'
import { CampaignUndo } from '@/renderer/screens/campaign/campaign-undo'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import { GeneratePanel } from '@/renderer/screens/campaign/generate-panel'
import { RunList } from '@/renderer/screens/campaign/run-list'
import { SlotView } from '@/renderer/screens/campaign/slot-view'
import { VariantTabs } from '@/renderer/screens/campaign/variant-tabs'
import { VideoPanel } from '@/renderer/screens/campaign/video-panel'
import { Icon } from '@/renderer/ui/icon'
import { PaidCount } from '@/renderer/ui/paid-count'
import { ReferenceRowsContext } from '@/renderer/ui/reference-picker/use-picture-list'
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
    <>
      <CampaignUndo projectId={projectId} campaignId={campaignId} />
      <DirectionGrids
        projectId={projectId}
        campaign={data}
        chosenId={variantId}
        onChoose={(id) => openVariant(projectId, campaignId, id)}
        onOpenBehind={(id) => openVariant(projectId, campaignId, id, true)}
        tileFooter={approvalFooter(approvalsData)}
      />
      {variant && (
        <p>
          Runs and panels below are for: {variant.title} · {variant.sizeLabel} · {variant.language}
        </p>
      )}
      <SlotView projectId={projectId} campaignId={campaignId} />
      {variant && (
        <ReferenceRowsContext.Provider value={preTick}>
          <GeneratePanel
            key={variant.id}
            projectId={projectId}
            campaignId={campaignId}
            variantId={variant.id}
            data={data}
            ticks={ticks}
            setTicks={setTicks}
            onStarted={(reply) => store.getState().track(reply)}
          />
        </ReferenceRowsContext.Provider>
      )}
      {variant && (
        <VideoPanel
          key={`video-${variant.id}`}
          projectId={projectId}
          variantId={variant.id}
          subjectId={variant.subjectIds[0]}
          onStarted={(reply) => store.getState().track(reply)}
        />
      )}
      <RunList projectId={projectId} store={store} />
      <CampaignSections projectId={projectId} campaignId={campaignId} data={data} />
    </>
  )

  return (
    <section className={styles.page} aria-label="Campaign">
      <div className={styles.head}>
        <button type="button" className={layout.quiet} onClick={props.onBack}>
          <Icon name="left" />
          Back to project
        </button>
        {data && <h2 className={styles.name}>{data.campaign.name}</h2>}
        {data && (
          <ApprovalBar
            projectId={projectId}
            campaignId={campaignId}
            store={approvals}
            titles={Object.fromEntries(data.variants.map((v) => [v.id, v.title]))}
          />
        )}
      </div>
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
