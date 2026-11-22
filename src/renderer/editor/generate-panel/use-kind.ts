// The kind the Generate panel shows (R2E-8) and why "Video" cannot be chosen (ED-4a), and
// whether the draft's run is still going, for the Section's "Running" mark. Reading only: no
// command is sent from here.
import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { generateDrafts, type GenerateKind } from '@/renderer/stores/generate-drafts'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'

const NO_SERVICE = 'No video service is set up. Add a key in Settings.'

// Why a video cannot be made on this layer; null when it can.
export function videoReason(
  type: LayerRow['type'],
  format: 'image' | 'video',
  services: number,
): string | null {
  if (type !== 'background') return 'Videos are made on the background layer.'
  if (format !== 'video') return 'To make a video, set Format to Video in the top bar first.'
  return services === 0 ? NO_SERVICE : null
}

// The providers that can make a video now (available, with their keys saved), and the kind
// the layer shows.
export function useKind(key: string, videoPost: boolean) {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const saved = useApp((s) => s.app?.secrets ?? EMPTY)
  const keyed = (names: readonly string[]) => names.every((n) => saved.some((s) => s.name === n))
  const ids = providers
    .filter((p) => p.available && p.jobs.includes('video') && keyed(p.secrets))
    .map((p) => p.id)
  const canVideo = videoPost && ids.length > 0
  // A kind not yet chosen (no draft, or one made on an image post) is "Video" here.
  const held = useStore(generateDrafts, (s) => s.drafts[key]?.kind ?? s.wanted[key])
  const made = useStore(generateDrafts, (s) => s.drafts[key] !== undefined)
  useEffect(() => {
    if (!canVideo) return
    const drafts = generateDrafts.getState()
    if (!made) drafts.wantKind(key, 'video')
    else if (drafts.drafts[key]?.kind === undefined) drafts.change(key, { kind: 'video' })
  }, [canVideo, key, made])
  const kind: GenerateKind = canVideo && (held ?? 'video') === 'video' ? 'video' : 'image'
  return { ids, kind }
}

const GOING: readonly JobRow['status'][] = ['queued', 'running']

// Whether the job is queued or running: job.list for the layer once, then job.updated. A job
// not yet heard of counts as queued.
export function useRunGoing(projectId: string, layerId: string, jobId: string | null): boolean {
  const api = useApi()
  const [seen, setSeen] = useState<{ jobId: string; status: JobRow['status'] } | null>(null)
  useEffect(() => {
    if (jobId === null) return
    let live = true
    let heard = false
    const stop = api.on('job.updated', (row) => {
      if (row.id !== jobId) return
      heard = true
      setSeen({ jobId, status: row.status })
    })
    void api.query('job.list', { projectId, layerId }).then((result) => {
      const rows = result.ok ? ((result.data as JobRow[] | null) ?? []) : []
      const found = rows.find((r) => r.id === jobId)
      if (live && !heard && found) setSeen({ jobId, status: found.status })
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, layerId, jobId])
  if (jobId === null) return false
  return seen?.jobId !== jobId || GOING.includes(seen.status)
}
