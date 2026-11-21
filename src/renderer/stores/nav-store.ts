// spec/editor.md, "What each tab keeps" [FR-211 to FR-214, FR-242, OI-31]: one store for the
// window. Per project: the open campaign tabs in order and which tab shows ('project' or a
// campaign ID). Per campaign: the open variant tabs in order and which shows ('overview' or a
// variant ID). Per variant tab: the selected layer and the zoom. Kept while the project is
// open, never saved. Variant IDs are unique within a project, so tab views are keyed by them.
// The selectors give stored objects (or frozen defaults), so React selectors stay stable.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Zoom } from '@/renderer/editor/zoom'

export type ProjectNav = { campaignTabs: string[]; shown: string }
export type CampaignNav = { variantTabs: string[]; shown: string }
export type TabView = { selectedLayerId: string | null; zoom: Zoom }

type ProjectState = {
  nav: ProjectNav
  campaigns: Record<string, CampaignNav>
  views: Record<string, TabView>
}

export type NavStoreState = {
  projects: Record<string, ProjectState>
  openCampaign(projectId: string, campaignId: string): void
  showCampaign(projectId: string, tab: string): void
  closeCampaign(projectId: string, campaignId: string): void
  stepCampaign(projectId: string, step: 1 | -1): void
  keepCampaigns(projectId: string, campaignIds: string[]): void
  keepProjects(projectIds: string[]): void
  openVariant(projectId: string, campaignId: string, variantId: string, behind?: boolean): void
  showVariant(projectId: string, campaignId: string, tab: string): void
  closeVariant(projectId: string, campaignId: string, variantId: string): void
  stepVariant(projectId: string, campaignId: string, step: 1 | -1): void
  keepVariants(projectId: string, campaignId: string, variantIds: string[]): void
  setView(projectId: string, variantId: string, change: Partial<TabView>): void
}

export type NavStore = StoreApi<NavStoreState>

export const PROJECT_TAB = 'project'
export const OVERVIEW_TAB = 'overview'

const NO_PROJECT: ProjectState = Object.freeze({
  nav: Object.freeze({ campaignTabs: [], shown: PROJECT_TAB }),
  campaigns: Object.freeze({}),
  views: Object.freeze({}),
})
const NO_CAMPAIGN: CampaignNav = Object.freeze({ variantTabs: [], shown: OVERVIEW_TAB })
const NO_VIEW: TabView = Object.freeze({ selectedLayerId: null, zoom: 'fit' })

const projectOf = (s: NavStoreState, projectId: string) => s.projects[projectId] ?? NO_PROJECT

export const projectNav = (s: NavStoreState, projectId: string): ProjectNav =>
  projectOf(s, projectId).nav

export const campaignNav = (s: NavStoreState, projectId: string, campaignId: string) =>
  projectOf(s, projectId).campaigns[campaignId] ?? NO_CAMPAIGN

export const tabView = (s: NavStoreState, projectId: string, variantId: string) =>
  projectOf(s, projectId).views[variantId] ?? NO_VIEW

// The tab list with the fixed first tab: Project before the campaigns, Overview before the
// variants. A closed shown tab gives way to the one before it.
function afterClose(tabs: string[], first: string, shown: string, closed: string): string {
  if (shown !== closed) return shown
  const all = [first, ...tabs]
  return all[all.indexOf(closed) - 1] ?? first
}

function stepped(tabs: string[], first: string, shown: string, step: number): string {
  const all = [first, ...tabs]
  const at = Math.max(all.indexOf(shown), 0)
  return all[(at + step + all.length) % all.length] ?? first
}

function without<T>(record: Record<string, T>, keys: string[]): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => !keys.includes(k)))
}

export function createNavStore(): NavStore {
  return createStore<NavStoreState>((set, get) => {
    function update(projectId: string, change: (p: ProjectState) => ProjectState) {
      const before = projectOf(get(), projectId)
      const after = change(before)
      if (after !== before) set({ projects: { ...get().projects, [projectId]: after } })
    }

    function setNav(projectId: string, change: (n: ProjectNav) => ProjectNav) {
      update(projectId, (p) => {
        const nav = change(p.nav)
        return nav === p.nav ? p : { ...p, nav }
      })
    }

    function setCampaign(projectId: string, id: string, change: (c: CampaignNav) => CampaignNav) {
      update(projectId, (p) => {
        const before = p.campaigns[id] ?? NO_CAMPAIGN
        const after = change(before)
        return after === before ? p : { ...p, campaigns: { ...p.campaigns, [id]: after } }
      })
    }

    // Removes campaign tabs, their variant tabs and those tabs' views.
    function dropCampaigns(projectId: string, gone: string[]) {
      if (gone.length === 0) return
      update(projectId, (p) => {
        const variants = gone.flatMap((id) => p.campaigns[id]?.variantTabs ?? [])
        const campaignTabs = p.nav.campaignTabs.filter((id) => !gone.includes(id))
        let shown = p.nav.shown
        for (const id of gone) shown = afterClose(p.nav.campaignTabs, PROJECT_TAB, shown, id)
        return {
          nav: { campaignTabs, shown: campaignTabs.includes(shown) ? shown : PROJECT_TAB },
          campaigns: without(p.campaigns, gone),
          views: without(p.views, variants),
        }
      })
    }

    function dropVariants(projectId: string, campaignId: string, gone: string[]) {
      if (gone.length === 0) return
      setCampaign(projectId, campaignId, (c) => {
        const variantTabs = c.variantTabs.filter((id) => !gone.includes(id))
        let shown = c.shown
        for (const id of gone) shown = afterClose(c.variantTabs, OVERVIEW_TAB, shown, id)
        return { variantTabs, shown: variantTabs.includes(shown) ? shown : OVERVIEW_TAB }
      })
      update(projectId, (p) => ({ ...p, views: without(p.views, gone) }))
    }

    return {
      projects: {},

      openCampaign: (projectId, campaignId) =>
        setNav(projectId, (n) => ({
          campaignTabs: n.campaignTabs.includes(campaignId)
            ? n.campaignTabs
            : [...n.campaignTabs, campaignId],
          shown: campaignId,
        })),
      showCampaign: (projectId, tab) =>
        setNav(projectId, (n) => (n.shown === tab ? n : { ...n, shown: tab })),
      closeCampaign: (projectId, campaignId) => dropCampaigns(projectId, [campaignId]),
      stepCampaign: (projectId, step) =>
        setNav(projectId, (n) => ({
          ...n,
          shown: stepped(n.campaignTabs, PROJECT_TAB, n.shown, step),
        })),
      keepCampaigns: (projectId, campaignIds) =>
        dropCampaigns(
          projectId,
          projectNav(get(), projectId).campaignTabs.filter((id) => !campaignIds.includes(id)),
        ),
      keepProjects: (projectIds) => {
        const gone = Object.keys(get().projects).filter((id) => !projectIds.includes(id))
        if (gone.length > 0) set({ projects: without(get().projects, gone) })
      },

      openVariant: (projectId, campaignId, variantId, behind = false) =>
        setCampaign(projectId, campaignId, (c) => ({
          variantTabs: c.variantTabs.includes(variantId)
            ? c.variantTabs
            : [...c.variantTabs, variantId],
          shown: behind ? c.shown : variantId,
        })),
      showVariant: (projectId, campaignId, tab) =>
        setCampaign(projectId, campaignId, (c) => (c.shown === tab ? c : { ...c, shown: tab })),
      closeVariant: (projectId, campaignId, variantId) =>
        dropVariants(projectId, campaignId, [variantId]),
      stepVariant: (projectId, campaignId, step) =>
        setCampaign(projectId, campaignId, (c) => ({
          ...c,
          shown: stepped(c.variantTabs, OVERVIEW_TAB, c.shown, step),
        })),
      keepVariants: (projectId, campaignId, variantIds) =>
        dropVariants(
          projectId,
          campaignId,
          campaignNav(get(), projectId, campaignId).variantTabs.filter(
            (id) => !variantIds.includes(id),
          ),
        ),

      setView: (projectId, variantId, change) =>
        update(projectId, (p) => {
          const before = p.views[variantId] ?? NO_VIEW
          const after = { ...before, ...change }
          const same =
            after.selectedLayerId === before.selectedLayerId && after.zoom === before.zoom
          return same ? p : { ...p, views: { ...p.views, [variantId]: after } }
        }),
    }
  })
}
