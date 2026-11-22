// Which finished job the result notice shows (spec/phases/round-2-editor.md D6, "Result
// notice", R2E-6). A job of a noticed kind that turns succeeded with seenAt null after the
// project frame appeared becomes the notice; the newest replaces an older one, and a job
// once noticed never comes back. It is hidden while the window shows its layer (or its
// variant, or its campaign's overview, for a job with less), and closes when the job is marked
// seen or the person closes it. It reads the activity store and the nav store only.
import { useState } from 'react'
import { EMPTY } from '@/renderer/app/app-context'
import { useActivity } from '@/renderer/app/activity-panel'
import { useNav } from '@/renderer/app/nav-context'
import type { ActivityEntry } from '@/renderer/stores/activity-store'
import {
  campaignNav,
  OVERVIEW_TAB,
  projectNav,
  tabView,
  type NavStoreState,
} from '@/renderer/stores/nav-store'
import type { JobKind } from '@/shared/config/job-kinds'
import type { JobRow } from '@/shared/schemas/rows/job'

export const NOTICE_WORDS: Partial<Record<JobKind, string>> = {
  image_generation: 'New pictures are ready',
  video_generation: 'A new video is ready',
  cutout: 'A cut-out is ready',
  generative_fill: 'An extended picture is ready',
}

// True when the window shows the job's layer, or its variant for a job with no layer.
export function placeShown(s: NavStoreState, projectId: string, job: JobRow): boolean {
  const { campaignId, variantId, layerId } = job
  if (campaignId === null || projectNav(s, projectId).shown !== campaignId) return false
  const tab = campaignNav(s, projectId, campaignId).shown
  if (variantId === null) return tab === OVERVIEW_TAB
  if (tab !== variantId) return false
  return layerId === null || tabView(s, projectId, variantId).selectedLayerId === layerId
}

type Held = {
  rows: readonly ActivityEntry[]
  current: string | null
  noticed: ReadonlySet<string>
}

const fresh = (job: JobRow, since: string) =>
  NOTICE_WORDS[job.kind] !== undefined &&
  job.status === 'succeeded' &&
  job.seenAt === null &&
  job.updatedAt > since

function nextHeld(held: Held, rows: readonly ActivityEntry[], since: string): Held {
  const found = rows.filter((e) => fresh(e.job, since) && !held.noticed.has(e.job.id))
  if (found.length === 0) return { ...held, rows }
  const newest = found.reduce((a, b) => (b.job.updatedAt > a.job.updatedAt ? b : a))
  const noticed = new Set([...held.noticed, ...found.map((e) => e.job.id)])
  return { rows, current: newest.job.id, noticed }
}

export function useResultNotice(projectId: string) {
  const rows = useActivity((s) => (s.projectId === projectId ? s.rows : EMPTY))
  const [since] = useState(() => new Date().toISOString())
  const [held, setHeld] = useState<Held>({ rows: EMPTY, current: null, noticed: new Set() })
  if (held.rows !== rows) setHeld(nextHeld(held, rows, since))
  const entry = rows.find((e) => e.job.id === held.current && e.job.seenAt === null) ?? null
  const shown = useNav((s) => entry !== null && placeShown(s, projectId, entry.job))
  const close = () => setHeld((h) => ({ ...h, current: null }))
  return { entry: shown ? null : entry, close }
}
