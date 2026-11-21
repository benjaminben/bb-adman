// The rule set panel's lists and its one way to change them (spec/phases/phase-06.md, design
// addition 8): each change sends ruleSet.update with the one list changed. A sent list shows at
// once and holds until campaign.get is read again; a refusal's own message is kept under the
// key of the list (or word field) that sent it, until that list is saved.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { CampaignSectionProps } from '@/renderer/screens/campaign/campaign-sections'
import type { RuleSetValues } from '@/shared/schemas/commands/campaign'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'

export type Refusals = Record<string, string>
export type SaveList = (key: string, change: Partial<RuleSetValues>) => void

type Sent = { base: RuleSetRow; lists: Partial<RuleSetValues> }

// A campaign file may lack a list; it reads as empty.
function withDefaults(row: Partial<RuleSetValues>): RuleSetValues {
  return {
    palette: row.palette ?? [],
    requiredAssetIds: row.requiredAssetIds ?? [],
    requiredWords: row.requiredWords ?? {},
    prohibitedWords: row.prohibitedWords ?? {},
  }
}

export function useRuleSet(props: CampaignSectionProps) {
  const api = useApi()
  const { projectId, campaignId } = props
  const stored = props.data.ruleSet
  const [sent, setSent] = useState<Sent>({ base: stored, lists: {} })
  const [refusals, setRefusals] = useState<Refusals>({})
  const overlay = sent.base === stored ? sent.lists : {}
  const lists = withDefaults({ ...stored, ...overlay })

  const save: SaveList = (key, change) => {
    void api.command('ruleSet.update', { projectId, campaignId, ...change }).then((result) => {
      setRefusals((now) => {
        const next = { ...now }
        if (result.ok) delete next[key]
        else next[key] = result.error.message
        return next
      })
      if (!result.ok) return
      setSent((now) => ({
        base: stored,
        lists: { ...(now.base === stored ? now.lists : {}), ...change },
      }))
    })
  }

  return { lists, refusals, save }
}

// The project's assets for the required files, read only once wanted (a file is required or
// the add list is open) and again on project.changed; null until read.
export function useProjectAssets(projectId: string, wanted: boolean): AssetList | null {
  const api = useApi()
  const [assets, setAssets] = useState<AssetList | null>(null)
  useEffect(() => {
    if (!wanted) return
    let live = true
    const read = () =>
      void api.query('asset.list', { projectId }).then((result) => {
        if (live) setAssets(result.ok ? ((result.data as AssetList | null) ?? []) : [])
      })
    read()
    const stop = api.on('project.changed', (payload) => {
      if (payload.projectId === projectId) read()
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, wanted])
  return assets
}
