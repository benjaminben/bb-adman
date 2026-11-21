// "Load a brief" (SPEC 14 1.41 TP-1): the picker, then brief.parse, then the summary. Create
// campaign sends subject.create for each new subject and then campaign.create; it stops at
// the first refusal, whose message the app store shows in the alert. Cancel sends nothing.
// A made campaign opens at once (A-45): onCreated gets campaign.create's campaignId.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import type { CampaignCreated } from '@/shared/schemas/commands/campaign-edit'
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { BriefSummary } from '@/renderer/screens/project-home/brief-summary'
import { campaignPlan } from '@/renderer/screens/project-home/campaign-input'

export type BriefLoadProps = {
  projectId: string
  subjects: SubjectRow[]
  campaigns: CampaignSummary[]
  onCreated: (campaignId: string) => void
}

export function BriefLoad(props: BriefLoadProps) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [reply, setReply] = useState<BriefParsed | null>(null)
  const [creating, setCreating] = useState(false)
  const { projectId } = props

  async function load() {
    const picked = await api.query('dialog.pickFiles', { purpose: 'brief' })
    const filePath = picked.ok ? (picked.data as PickedPaths | null)?.paths[0] : undefined
    if (filePath === undefined) return
    const result = await command('brief.parse', { projectId, filePath })
    if (result.ok) setReply(result.data as BriefParsed)
  }

  if (reply === null) {
    return (
      <button type="button" onClick={() => void load()}>
        Load a brief
      </button>
    )
  }

  const heldSubjectIds = props.subjects.map((s) => s.id)
  const plan = campaignPlan(projectId, reply, heldSubjectIds)

  async function create() {
    if (!plan.ok) return
    setCreating(true)
    for (const subject of plan.subjects) {
      if (!(await command('subject.create', subject)).ok) return setCreating(false)
    }
    const result = await command('campaign.create', plan.campaign)
    setCreating(false)
    if (!result.ok) return
    setReply(null)
    const created = result.data as CampaignCreated | null
    if (created) props.onCreated(created.campaignId)
  }

  return (
    <BriefSummary
      reply={reply}
      plan={plan}
      heldSubjectIds={heldSubjectIds}
      creating={creating}
      onCreate={() => void create()}
      onCancel={() => setReply(null)}
    />
  )
}
