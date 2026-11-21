// The generate fields' memory (spec/screens-ai.md, "Generate fields"; A-70): per layer, the
// prompt, the chosen reference pictures in order, and the last run started from them. Kept in
// the window while it is open, never saved. One store for the window, keyed by project and
// layer, so a draft survives a change of selected layer or tab. The shell tells it the shown
// project; when that closes or changes, every draft is dropped, as the activity store does.
import { createStore } from 'zustand/vanilla'

export type GenerateRun = { jobId: string; count: number }

export type GenerateDraft = {
  prompt: string
  referenceAssetIds: string[]
  run: GenerateRun | null
}

export type GenerateDraftsState = {
  projectId: string | null
  drafts: Readonly<Record<string, GenerateDraft>>
  follow(projectId: string | null): void
  // Sets the first draft of a layer; a draft that is there already is kept.
  start(key: string, draft: GenerateDraft): void
  change(key: string, patch: Partial<GenerateDraft>): void
}

export const draftKey = (projectId: string, layerId: string) => `${projectId}/${layerId}`

export const generateDrafts = createStore<GenerateDraftsState>((set, get) => ({
  projectId: null,
  drafts: {},
  follow(projectId) {
    if (projectId !== get().projectId) set({ projectId, drafts: {} })
  },
  start(key, draft) {
    if (get().drafts[key]) return
    set({ drafts: { ...get().drafts, [key]: draft } })
  },
  change(key, patch) {
    const held = get().drafts[key]
    if (!held) return
    set({ drafts: { ...get().drafts, [key]: { ...held, ...patch } } })
  },
}))
