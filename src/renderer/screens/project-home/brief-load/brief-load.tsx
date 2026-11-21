// "Load a brief" and "Type a brief" (spec/screens-campaign.md, "The brief form"): the picker
// and brief.parse, or an empty form; then the brief form. P4-15: a Markdown or text brief is
// read with AI instead (use-text-brief.tsx, spec/screens-ai.md "Reading a brief with AI"). Create campaign sends
// subject.create for each new subject, asset.update for each photo to attach, then
// campaign.create (spec/subject-photos.md, "Create campaign"); it stops at the first refusal,
// whose message the app store shows in the alert. A made campaign opens at once (A-45):
// onCreated gets campaign.create's campaignId. SP-4: a loaded brief's photos are imported
// before the form opens (use-brief-photos.ts). Cancel, and the page going away with the form
// open, remove every photo the form added (A-111); after a refused step the form is made safe
// to press again (A-118).
import { useEffect, useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { briefFileKind } from '@/shared/brief/brief-file-kind'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { BriefForm } from '@/renderer/screens/project-home/brief-form'
import { subjectIds } from '@/renderer/screens/project-home/brief-form-problems'
import { removeAddedPhotos } from '@/renderer/screens/project-home/subject-photos'
import {
  formFromDraft,
  type BriefFormValues,
  type CampaignPlan,
} from '@/renderer/screens/project-home/brief-form-model'
import layout from '@/renderer/ui/layout.module.css'
import { useBriefPhotos } from './use-brief-photos'
import { useTextBrief } from './use-text-brief'

export type BriefLoadProps = {
  projectId: string
  subjects: SubjectRow[]
  campaigns: CampaignSummary[]
  onCreated: (campaignId: string) => void
}

type Change = (values: BriefFormValues) => BriefFormValues

// The form after a refused step: each row whose subject was made uses that subject, so it is
// not made twice, and each photo now attached leaves the form's photos, so it is not removed.
function afterRefusal(made: string[], attached: string[]): Change {
  return (values) => {
    const ids = subjectIds(values.subjects)
    const subjects = values.subjects.map((s, i) => {
      const id = ids[i] ?? ''
      const row =
        s.mode === 'new' && made.includes(id) ? { mode: 'existing' as const, existingId: id } : {}
      return { ...s, ...row, photos: s.photos.filter((p) => !attached.includes(p.assetId)) }
    })
    return { ...values, subjects }
  }
}

export function BriefLoad(props: BriefLoadProps) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [opened, setOpened] = useState<BriefFormValues | null>(null)
  const [creating, setCreating] = useState(false)
  const { projectId } = props
  const heldSubjectIds = props.subjects.map((s) => s.id)
  const briefPhotos = useBriefPhotos(projectId)
  // The open form's newest values, kept without a re-render; null once no form is open.
  const formValues = useRef<BriefFormValues | null>(null)
  const textBrief = useTextBrief(projectId, (parsed) =>
    setOpened(formFromDraft(parsed, heldSubjectIds)),
  )

  useEffect(() => {
    const form = formValues
    return () => dropPhotos(form.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page goes away
  }, [])

  function dropPhotos(values: BriefFormValues | null) {
    formValues.current = null
    if (values)
      removeAddedPhotos(
        api,
        projectId,
        values.subjects.flatMap((s) => s.photos),
      )
  }

  async function load() {
    const picked = await api.query('dialog.pickFiles', { purpose: 'brief' })
    const filePath = picked.ok ? (picked.data as PickedPaths | null)?.paths[0] : undefined
    if (filePath === undefined) return
    if (briefFileKind(filePath) === 'text') return textBrief.start(filePath)
    const result = await command('brief.parse', { projectId, filePath })
    if (!result.ok) return
    const parsed = result.data as BriefParsed
    const photos = await briefPhotos.importPhotos(parsed)
    if (photos !== null) setOpened(formFromDraft(parsed, heldSubjectIds, photos))
  }

  async function create(plan: Extract<CampaignPlan, { ok: true }>): Promise<Change | void> {
    setCreating(true)
    const made: string[] = []
    const attached: string[] = []
    const refused = () => {
      setCreating(false)
      return afterRefusal(made, attached)
    }
    for (const subject of plan.subjects) {
      if (!(await command('subject.create', subject)).ok) return refused()
      made.push(subject.id)
    }
    for (const entry of plan.attach) {
      if (!(await command('asset.update', entry)).ok) return refused()
      attached.push(entry.assetId)
    }
    const result = await command('campaign.create', plan.campaign)
    if (!result.ok) return refused()
    setCreating(false)
    formValues.current = null
    setOpened(null)
    const created = result.data as CampaignCreated | null
    if (created) props.onCreated(created.campaignId)
  }

  if (opened === null) {
    return (
      <div className={layout.row}>
        <button type="button" onClick={() => void load()}>
          Load a brief
        </button>
        <button type="button" onClick={() => setOpened(formFromDraft(null, heldSubjectIds))}>
          Type a brief
        </button>
        {briefPhotos.adding && <p role="status">Adding the brief's photos…</p>}
        {textBrief.dialogs}
      </div>
    )
  }

  return (
    <BriefForm
      projectId={projectId}
      initial={opened}
      subjects={props.subjects}
      campaigns={props.campaigns}
      creating={creating}
      onCreate={create}
      onCancel={() => {
        dropPhotos(formValues.current)
        setOpened(null)
      }}
      onValues={(values) => {
        formValues.current = values
      }}
    />
  )
}
