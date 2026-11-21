// spec/approvals.md "The campaign page", the store: one per campaign page. Holds the
// approvals.forCampaign reply and reads it again on approvals.changed for its campaign and on
// project.changed for its project. While the link is live and ready, it sends approvals.refresh
// once on open, every 60 s while the window has focus, when the window gains focus, and on
// "Refresh" (A-92), one at a time. The refresh goes through api.command directly, so its
// failure stays in the bar and never reaches the error banner.
import { createStore, type StoreApi } from 'zustand/vanilla'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import type { AdmanApi } from '@/shared/schemas/api'
import type { ApprovalsRefreshReply } from '@/shared/schemas/commands/approvals'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'

export const REFRESH_EVERY_MS = 60_000

export type ApprovalsStoreState = {
  data: ApprovalsForCampaign | null
  refreshing: boolean
  // The last refresh's failure sentence, for the bar.
  failure: string | null
  // The approval_link_gone sentence after a refresh found the link gone.
  notice: string | null
  load(): Promise<void>
  refresh(): Promise<void>
  // Reads, refreshes once, and starts the timer, focus and event listeners; gives the stop.
  start(): () => void
}

export type ApprovalsStore = StoreApi<ApprovalsStoreState>

export function canRefresh(data: ApprovalsForCampaign | null): boolean {
  return data?.ready === 'ready' && data.link?.state === 'live'
}

export function createApprovalsStore(
  api: AdmanApi,
  projectId: string,
  campaignId: string,
): ApprovalsStore {
  const input = { projectId, campaignId }
  // Counts reads, so a reply that a later read overtook is dropped.
  let reads = 0

  return createStore<ApprovalsStoreState>((set, get) => {
    async function load(): Promise<void> {
      reads += 1
      const mine = reads
      const result = await api.query('approvals.forCampaign', input)
      if (mine !== reads || !result.ok || !result.data) return
      const data = result.data as ApprovalsForCampaign
      set(data.link?.state === 'live' ? { data, notice: null } : { data })
    }

    async function refresh(): Promise<void> {
      if (get().refreshing || !canRefresh(get().data)) return
      set({ refreshing: true })
      const result = await api.command('approvals.refresh', input)
      if (!result.ok) return set({ refreshing: false, failure: result.error.message })
      const reply = result.data as ApprovalsRefreshReply | null
      const notice =
        reply?.gone === true ? APPROVALS_REASON_MESSAGES.approval_link_gone : get().notice
      set({ refreshing: false, failure: null, notice })
    }

    function start(): () => void {
      let live = true
      void load().then(() => {
        if (live) void refresh()
      })
      const onFocus = () => void refresh()
      const timer = setInterval(() => {
        if (document.hasFocus()) void refresh()
      }, REFRESH_EVERY_MS)
      window.addEventListener('focus', onFocus)
      const stops = [
        api.on('approvals.changed', (event) => {
          if (event.projectId === projectId && event.campaignId === campaignId) void load()
        }),
        api.on('project.changed', (event) => {
          if (event.projectId === projectId) void load()
        }),
      ]
      return () => {
        live = false
        clearInterval(timer)
        window.removeEventListener('focus', onFocus)
        for (const stop of stops) stop()
      }
    }

    return {
      data: null,
      refreshing: false,
      failure: null,
      notice: null,
      load,
      refresh,
      start,
    }
  })
}
