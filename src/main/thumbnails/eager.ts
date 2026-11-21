// spec/scene.md, "The render service": eager thumbnails and changed files. It also keeps each
// open project's variant revs in memory, because project.close calls projectClosed after the
// file has closed, and the clean-up must know which rev of each variant is current.
import type { BusEvent } from '@/main/commands/bus'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRows } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { ProjectChangedPayload } from '@/shared/schemas/events'
import { removeThumbnail } from './cache'
import type { DrawQueue } from './queue'
import { layerAssetIds } from './scene-input'

// A variant is drawn once it has been quiet this long.
export const QUIET_MS = 1000

export function createEagerThumbnails(o: {
  deps: () => CoreDeps
  queue: DrawQueue
  request: (projectId: string, variantId: string) => void
  // A variant's thumbnail file was deleted because a file it uses changed.
  filesChanged: (projectId: string, variantId: string) => void
}) {
  const revs = new Map<string, Map<string, number>>()
  const timers = new Map<string, { projectId: string; timer: ReturnType<typeof setTimeout> }>()
  const keyOf = (projectId: string, variantId: string) => `${projectId}/${variantId}`

  function noteAll(project: ProjectHandle): Map<string, number> {
    const known = new Map<string, number>()
    for (const v of readWireRows(project.db, 'variant') as VariantRow[]) known.set(v.id, v.rev)
    revs.set(project.projectId, known)
    return known
  }

  function unschedule(projectId: string, variantId: string): void {
    const key = keyOf(projectId, variantId)
    clearTimeout(timers.get(key)?.timer)
    timers.delete(key)
  }

  function schedule(projectId: string, variantId: string): void {
    unschedule(projectId, variantId)
    const timer = setTimeout(() => {
      timers.delete(keyOf(projectId, variantId))
      o.request(projectId, variantId)
    }, QUIET_MS)
    timers.set(keyOf(projectId, variantId), { projectId, timer })
  }

  function projectChanged(p: ProjectChangedPayload): void {
    const project = o.deps().projects.get(p.projectId)
    if (!project) return
    const variants = p.changed.variant ?? []
    const removed = p.removed.variant ?? []
    if (!revs.has(p.projectId) || variants.length > 0 || removed.length > 0) noteAll(project)
    for (const row of variants) schedule(p.projectId, String(row.id))
    for (const variantId of removed) {
      unschedule(p.projectId, variantId)
      o.queue.drop(p.projectId, variantId)
    }
  }

  async function filesChanged(projectId: string, assetIds: string[]): Promise<void> {
    const project = o.deps().projects.get(projectId)
    if (!project) return
    const ids = new Set(assetIds)
    const using = new Set(
      (readWireRows(project.db, 'layer') as LayerRow[])
        .filter((l) => layerAssetIds(l).some((id) => ids.has(id)))
        .map((l) => l.variantId),
    )
    const known = noteAll(project)
    for (const variantId of using) {
      const rev = known.get(variantId)
      if (rev === undefined) continue
      await removeThumbnail(o.deps().userDataDir, projectId, variantId, rev).catch(() => false)
      o.filesChanged(projectId, variantId)
      o.request(projectId, variantId)
    }
  }

  return {
    // Keeps the rev of one variant; the first time a project is seen, all of its variants.
    noteRev(project: ProjectHandle, variantId: string, rev: number): void {
      const known = revs.get(project.projectId)
      if (known) known.set(variantId, rev)
      else noteAll(project)
    },
    // Never throws: index.ts calls it on the way to the app window.
    onEvent(event: BusEvent): void {
      if (event.name === 'project.changed') {
        try {
          projectChanged(event.payload)
        } catch {
          return
        }
      }
      if (event.name === 'asset.changedOnDisk') {
        void filesChanged(event.payload.projectId, event.payload.assetIds).catch(() => undefined)
      }
    },
    // Stops the project's timers and queued draws. Returns the revs it knew, if it knew them.
    projectClosed(projectId: string): Map<string, number> | undefined {
      for (const [key, t] of timers) {
        if (t.projectId !== projectId) continue
        clearTimeout(t.timer)
        timers.delete(key)
      }
      o.queue.dropProject(projectId)
      const known = revs.get(projectId)
      revs.delete(projectId)
      return known
    },
  }
}
