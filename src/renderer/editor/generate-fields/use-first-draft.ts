// The facts the generate fields start from (spec/screens-ai.md, "Generate fields"): the
// variant's subjects, and, the first time a layer is shown, its draft: the prompt filled by
// prefilledPrompt and the photos of the variant's subjects from every image (subjectPhotoIds,
// SP-7): up to MAX_REFERENCES_PER_RUN, oldest first, skipping a picture that cannot be sent.
// A later visit keeps the draft as the user left it (A-70). R2E-1 (D1): the prompt leaves out
// the message when the variant's text layers hold words, read when the draft is made; text
// added later does not rewrite a draft.
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useApi } from '@/renderer/app/app-context'
import { subjectPhotoIds } from '@/renderer/ui/reference-picker/reference-rows'
import { draftKey, generateDrafts, type GenerateDraft } from '@/renderer/stores/generate-drafts'
import { hasWordsOnLayers, prefilledPrompt } from '@/shared/generation/prompt'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'

type Facts = { prompt: string; subjectIds: string[] }

function factsFrom(data: CampaignGet | null, variantId: string, words: boolean): Facts {
  if (!data) return { prompt: '', subjectIds: [] }
  const { campaign } = data
  const subjectIds = data.variants.find((v) => v.id === variantId)?.subjectIds ?? []
  const subjects = data.subjects.filter((s) => subjectIds.includes(s.id))
  const prompt = prefilledPrompt({
    subjects: subjects.map((s) => ({ name: s.name, description: s.description })),
    audience: campaign.audience,
    region: campaign.region,
    message: campaign.message,
    wordsOnLayers: words,
  })
  return { prompt, subjectIds }
}

export function useFirstDraft(
  projectId: string,
  campaignId: string | null,
  layer: LayerRow,
  layers: LayerRow[] = [],
) {
  const api = useApi()
  const key = draftKey(projectId, layer.id)
  const draft: GenerateDraft | undefined = useStore(generateDrafts, (s) => s.drafts[key])
  const [subjectIds, setSubjectIds] = useState<string[]>([])
  const { variantId } = layer
  // A ref, so a layer edit does not read the campaign again; the draft is made once (A-70).
  // It is set by the first effect, which runs before the one that reads it.
  const words = useRef(false)
  const hasWords = hasWordsOnLayers(layers)
  useEffect(() => {
    words.current = hasWords
  }, [hasWords])

  useEffect(() => {
    let live = true
    async function read() {
      const got =
        campaignId === null ? null : await api.query('campaign.get', { projectId, campaignId })
      const data = got?.ok ? (got.data as CampaignGet | null) : null
      const facts = factsFrom(data, variantId, words.current)
      if (!live) return
      setSubjectIds(facts.subjectIds)
      if (generateDrafts.getState().drafts[key]) return
      const list = await api.query('asset.list', { projectId, kind: 'image' })
      const rows = list.ok ? ((list.data as AssetList | null) ?? []) : []
      const referenceAssetIds = subjectPhotoIds(rows, facts.subjectIds)
      generateDrafts.getState().start(key, { prompt: facts.prompt, referenceAssetIds, run: null })
    }
    void read()
    return () => {
      live = false
    }
  }, [api, projectId, campaignId, variantId, key])

  return { key, draft, subjectId: subjectIds[0] }
}
