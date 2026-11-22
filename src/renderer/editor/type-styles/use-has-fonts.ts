// Whether the shown project's asset library holds a font (R2E-3, D3): read on mount and again on
// each project.changed of that project that names an asset. Null until the first answer, and
// while a read is refused, so nothing is offered on a guess.
import { useEffect, useState } from 'react'
import type { AdmanApi } from '@/shared/schemas/api'
import type { ProjectChangedPayload } from '@/shared/schemas/events'

const namesAsset = (p: ProjectChangedPayload) =>
  (p.changed.asset?.length ?? 0) > 0 || (p.removed.asset?.length ?? 0) > 0

export function useHasFonts(api: AdmanApi, projectId: string): boolean | null {
  const [hasFonts, setHasFonts] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    const read = async () => {
      const result = await api.query('asset.list', { projectId, library: 'asset', kind: 'font' })
      if (!live) return
      const rows = result.ok ? ((result.data as unknown[] | null) ?? []) : null
      setHasFonts(rows === null ? null : rows.length > 0)
    }
    void read()
    const stop = api.on('project.changed', (payload) => {
      if (payload.projectId === projectId && namesAsset(payload)) void read()
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId])

  return hasFonts
}
