// The project's fonts for the brief form's "Fonts" lines (spec/brief-brand.md, "What it
// shows"): asset.list { projectId, kind: 'font' } when the form opens and again on
// project.changed for this project. A reply older than the newest read is dropped. A refused
// read leaves the list empty, so a font then shows by no name. Nothing is read while the form
// holds no brand font (wanted false): there is no name to show.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'

export function useProjectFonts(projectId: string, wanted: boolean): AssetList {
  const api = useApi()
  const [fonts, setFonts] = useState<AssetList>([])

  useEffect(() => {
    if (!wanted) return
    let live = true
    let newest = 0
    const load = () => {
      const asked = ++newest
      void api.query('asset.list', { projectId, kind: 'font' }).then((result) => {
        if (!live || asked !== newest) return
        setFonts(result.ok ? ((result.data as AssetList | null) ?? []) : [])
      })
    }
    load()
    const stop = api.on('project.changed', (payload) => {
      if (payload.projectId === projectId) load()
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, wanted])

  return fonts
}
