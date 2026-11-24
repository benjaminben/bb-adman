// spec/approvals.md "An update in the background" (D-110): the window's one owner of each
// campaign's "Update gallery", part of the app store so it outlives the dialog and the
// campaign page. Per {projectId, campaignId}: whether it runs, its latest approvals.progress
// and whether "Stop" was pressed. The update goes through the app store's command, so
// NEEDS_KEY asks for the key and a refusal reaches the banner; when that command settles the
// entry is cleared, keeping only a refusal's sentence for the dialog's alert.
import type { AdmanApi } from '@/shared/schemas/api'
import type { EventMap } from '@/shared/schemas/events'
import type { Result } from '@/shared/schemas/result'

export type UpdateCounts = Omit<EventMap['approvals.progress'], 'projectId' | 'campaignId'>

export type GalleryUpdate = {
  running: boolean
  // null before the first event.
  progress: UpdateCounts | null
  stopping: boolean
  // The sentence of the last update's refusal, until another command is sent from the dialog.
  refusal: string | null
}

export type GalleryUpdatesState = {
  updates: Record<string, GalleryUpdate>
  updateGallery(projectId: string, campaignId: string): Promise<Result<unknown>>
  stopUpdate(projectId: string, campaignId: string): void
  clearRefusal(projectId: string, campaignId: string): void
}

type Host = GalleryUpdatesState & {
  command(name: string, input: unknown): Promise<Result<unknown>>
}
type Set = (part: Partial<GalleryUpdatesState>) => void

export const updateKey = (projectId: string, campaignId: string) => `${projectId}/${campaignId}`

export function galleryUpdates(api: AdmanApi, set: Set, get: () => Host): GalleryUpdatesState {
  function put(key: string, entry: GalleryUpdate | null) {
    const updates = { ...get().updates }
    if (entry === null) delete updates[key]
    else updates[key] = entry
    set({ updates })
  }

  return {
    updates: {},

    async updateGallery(projectId, campaignId) {
      const key = updateKey(projectId, campaignId)
      put(key, { running: true, progress: null, stopping: false, refusal: null })
      const stop = api.on('approvals.progress', (event) => {
        const held = get().updates[key]
        if (event.projectId !== projectId || event.campaignId !== campaignId) return
        if (!held?.running) return
        const { step, done, total, unitsDone, unitsTotal } = event
        put(key, { ...held, progress: { step, done, total, unitsDone, unitsTotal } })
      })
      try {
        const result = await get().command('approvals.publish', { projectId, campaignId })
        put(key, result.ok ? null : { ...idle(), refusal: result.error.message })
        return result
      } catch (error) {
        put(key, null)
        throw error
      } finally {
        stop()
      }
    },

    stopUpdate(projectId, campaignId) {
      const key = updateKey(projectId, campaignId)
      const held = get().updates[key]
      if (!held?.running || held.stopping) return
      put(key, { ...held, stopping: true })
      void get().command('approvals.cancelUpdate', { projectId, campaignId })
    },

    clearRefusal(projectId, campaignId) {
      const key = updateKey(projectId, campaignId)
      if (get().updates[key]?.running === false) put(key, null)
    },
  }
}

const idle = (): GalleryUpdate => ({
  running: false,
  progress: null,
  stopping: false,
  refusal: null,
})
