// A loaded brief's photos (spec/subject-photos.md, "Photos from a loaded brief"; A-111, A-124):
// before the form opens, each subject's checked paths from the brief.parse reply are copied into
// the asset library with one asset.import per subject that has any, so one bad file spoils only
// that subject's batch. Each note becomes its line. Security: the only paths sent are the
// reply's subjectPictures, always with copy: true; no path or note is drawn, logged or kept.
// If the page goes away meanwhile, the new assets are removed again at once.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetImportReply } from '@/shared/schemas/commands/asset'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import {
  emptySubject,
  type BriefPhotos,
  type FormPhoto,
} from '@/renderer/screens/project-home/brief-form-model'
import { removeAddedPhotos, withImported } from '@/renderer/screens/project-home/subject-photos'
import { noteLine } from './photo-notes'

export function useBriefPhotos(projectId: string) {
  const api = useApi()
  const [adding, setAdding] = useState(false)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // The photos and notes for each draft subject, or null when the page went away meanwhile.
  async function importPhotos(parsed: BriefParsed): Promise<BriefPhotos | null> {
    const pictures = parsed.subjectPictures ?? []
    const result: BriefPhotos = []
    const made: FormPhoto[] = []
    setAdding(pictures.some((p) => p.paths.length > 0))
    for (const { paths, notes } of pictures) {
      const row = { ...emptySubject(), notes: notes.map(noteLine) }
      if (paths.length === 0) {
        result.push(row)
        continue
      }
      const reply = await api.command('asset.import', {
        projectId,
        paths,
        library: 'asset',
        copy: true,
      })
      if (!reply.ok) {
        const line = `The brief's photos could not be added: ${reply.error.message}`
        result.push({ photos: [], notes: [...row.notes, line] })
        continue
      }
      const done = withImported(row, reply.data as AssetImportReply, paths)
      made.push(...done.photos)
      result.push({ photos: done.photos, notes: done.notes })
      if (!live.current) break
    }
    if (!live.current) {
      removeAddedPhotos(api, projectId, made)
      return null
    }
    setAdding(false)
    return result
  }

  return { adding, importPhotos }
}
