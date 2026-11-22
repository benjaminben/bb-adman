// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "Reading"): asset.list for the
// project, both libraries and every kind, while the panel is open (the panel's body mounts it
// on open): then again on each project.changed and asset.changedOnDisk for this project. A
// reply older than the newest read is dropped. Retry reads again. Each row goes through assetView before it is
// kept, so no path is held here.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { assetView, type AssetView } from './asset-view'

export type AssetsRead =
  { kind: 'loading' } | { kind: 'refused'; message: string } | { kind: 'done'; assets: AssetView[] }

export function useAssets(projectId: string): { read: AssetsRead; retry(): void } {
  const api = useApi()
  const [read, setRead] = useState<AssetsRead>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let latest = 0
    const load = async () => {
      const turn = ++latest
      const reply = await api.query('asset.list', { projectId })
      if (turn !== latest) return
      if (!reply.ok) return setRead({ kind: 'refused', message: reply.error.message })
      const rows = (reply.data as AssetList | null) ?? []
      setRead({ kind: 'done', assets: rows.map(assetView) })
    }
    void load()
    const ours = (payload: { projectId: string }) => {
      if (payload.projectId === projectId) void load()
    }
    const stops = [api.on('project.changed', ours), api.on('asset.changedOnDisk', ours)]
    return () => {
      latest = -1
      for (const stop of stops) stop()
    }
  }, [api, projectId, attempt])

  return { read, retry: () => setAttempt((n) => n + 1) }
}
