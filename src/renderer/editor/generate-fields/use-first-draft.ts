// The facts the generate fields start from (spec/screens-ai.md, "Generate fields"): the
// variant's subjects, and, the first time a layer is shown, its draft: the prompt filled by
// prefilledPrompt and the reference pictures of the variant's subjects, up to
// MAX_REFERENCES_PER_RUN, skipping a picture that cannot be sent. A later visit keeps the
// draft as the user left it (A-70).
import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useApi } from '@/renderer/app/app-context'
import { whyNot } from '@/renderer/ui/reference-picker/reference-list'
import { draftKey, generateDrafts, type GenerateDraft } from '@/renderer/stores/generate-drafts'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import { prefilledPrompt } from '@/shared/generation/prompt'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'

type Facts = { prompt: string; subjectIds: string[] }

function factsFrom(data: CampaignGet | null, variantId: string): Facts {
  if (!data) return { prompt: '', subjectIds: [] }
  const { campaign } = data
  const subjectIds = data.variants.find((v) => v.id === variantId)?.subjectIds ?? []
  const subjects = data.subjects.filter((s) => subjectIds.includes(s.id))
  const prompt = prefilledPrompt({
    subjects: subjects.map((s) => ({ name: s.name, description: s.description })),
    audience: campaign.audience,
    region: campaign.region,
    message: campaign.message,
  })
  return { prompt, subjectIds }
}

function subjectPictures(rows: AssetList, subjectIds: string[]): string[] {
  return rows
    .filter((a) => a.subjectId !== null && subjectIds.includes(a.subjectId) && whyNot(a) === null)
    .slice(0, MAX_REFERENCES_PER_RUN)
    .map((a) => a.id)
}

export function useFirstDraft(projectId: string, campaignId: string | null, layer: LayerRow) {
  const api = useApi()
  const key = draftKey(projectId, layer.id)
  const draft: GenerateDraft | undefined = useStore(generateDrafts, (s) => s.drafts[key])
  const [subjectIds, setSubjectIds] = useState<string[]>([])
  const { variantId } = layer

  useEffect(() => {
    let live = true
    async function read() {
      const got =
        campaignId === null ? null : await api.query('campaign.get', { projectId, campaignId })
      const facts = factsFrom(got?.ok ? (got.data as CampaignGet | null) : null, variantId)
      if (!live) return
      setSubjectIds(facts.subjectIds)
      if (generateDrafts.getState().drafts[key]) return
      const list = await api.query('asset.list', { projectId, library: 'reference', kind: 'image' })
      const rows = list.ok ? ((list.data as AssetList | null) ?? []) : []
      const referenceAssetIds = subjectPictures(rows, facts.subjectIds)
      generateDrafts.getState().start(key, { prompt: facts.prompt, referenceAssetIds, run: null })
    }
    void read()
    return () => {
      live = false
    }
  }, [api, projectId, campaignId, variantId, key])

  return { key, draft, subjectId: subjectIds[0] }
}
