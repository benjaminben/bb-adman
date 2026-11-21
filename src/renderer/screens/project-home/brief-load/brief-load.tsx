// "Load a brief" and "Type a brief" (spec/screens-campaign.md, "The brief form"): the picker
// and brief.parse, or an empty form; then the brief form. Create campaign sends
// subject.create for each new subject and then campaign.create; it stops at the first refusal,
// whose message the app store shows in the alert. Cancel sends nothing. A made campaign opens
// at once (A-45): onCreated gets campaign.create's campaignId.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { BriefForm } from '@/renderer/screens/project-home/brief-form'
import {
  formFromDraft,
  type BriefFormValues,
  type CampaignPlan,
} from '@/renderer/screens/project-home/brief-form-model'
import layout from '@/renderer/ui/layout.module.css'

export type BriefLoadProps = {
  projectId: string
  subjects: SubjectRow[]
  campaigns: CampaignSummary[]
  onCreated: (campaignId: string) => void
}

export function BriefLoad(props: BriefLoadProps) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [opened, setOpened] = useState<BriefFormValues | null>(null)
  const [creating, setCreating] = useState(false)
  const { projectId } = props
  const heldSubjectIds = props.subjects.map((s) => s.id)

  async function load() {
    const picked = await api.query('dialog.pickFiles', { purpose: 'brief' })
    const filePath = picked.ok ? (picked.data as PickedPaths | null)?.paths[0] : undefined
    if (filePath === undefined) return
    const result = await command('brief.parse', { projectId, filePath })
    if (result.ok) setOpened(formFromDraft(result.data as BriefParsed, heldSubjectIds))
  }

  async function create(plan: Extract<CampaignPlan, { ok: true }>) {
    setCreating(true)
    for (const subject of plan.subjects) {
      if (!(await command('subject.create', subject)).ok) return setCreating(false)
    }
    const result = await command('campaign.create', plan.campaign)
    setCreating(false)
    if (!result.ok) return
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
      onCreate={(plan) => void create(plan)}
      onCancel={() => setOpened(null)}
    />
  )
}
