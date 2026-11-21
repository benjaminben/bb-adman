// The project's pictures for the brief form (spec/subject-photos.md, "Reading the project's
// pictures"): asset.list { projectId, kind: 'image' } when the form opens and again on
// project.changed for this project. A reply older than the newest read is dropped. A refused
// read leaves images null and gives its message.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { ProjectImages } from '@/renderer/screens/project-home/brief-form-photos'

export type ImagesRead = { images: ProjectImages; refusal: string | null }

export function useProjectImages(projectId: string): ImagesRead {
  const api = useApi()
  const [read, setRead] = useState<ImagesRead>({ images: null, refusal: null })

  useEffect(() => {
    let live = true
    let newest = 0
    const load = () => {
      const asked = ++newest
      void api.query('asset.list', { projectId, kind: 'image' }).then((result) => {
        if (!live || asked !== newest) return
        setRead(
          result.ok
            ? { images: (result.data as AssetList | null) ?? [], refusal: null }
            : { images: null, refusal: result.error.message },
        )
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
  }, [api, projectId])

  return read
}
