// The generate fields' memory (spec/screens-ai.md, "Generate fields"; A-70): per layer, the
// prompt, the chosen reference pictures in order, and the last run started from them. Kept in
// the window while it is open, never saved. One store for the window, keyed by project and
// layer, so a draft survives a change of selected layer or tab. The shell tells it the shown
// project; when that closes or changes, every draft is dropped, as the activity store does.
// R2E-4 (spec/phases/round-2-editor.md D4, "Draft"): a draft also holds its kind, where the
// run starts from and the video fields. A draft made without them reads through draftOf.
import { createStore } from 'zustand/vanilla'
import { START_SECONDS } from '@/renderer/editor/generate-panel/video-length'

export type GenerateKind = 'image' | 'video'
// The "Start from" choices: a prompt only, this layer's picture, another picture of the same
// shape, and (videos only) reference pictures.
export type GenerateStart = 'prompt' | 'layer' | 'shape' | 'references'

export type GenerateRun = { jobId: string; count: number; kind?: GenerateKind }

type DraftFields = {
  kind: GenerateKind
  start: GenerateStart
  startAssetId: string | null
  videoPictureIds: string[]
  seconds: string
  promptTyped: boolean
}

export type GenerateDraft = {
  prompt: string
  referenceAssetIds: string[]
  run: GenerateRun | null
} & Partial<DraftFields>

export type FullDraft = GenerateDraft & DraftFields

const DEFAULTS: DraftFields = {
  kind: 'image',
  start: 'prompt',
  startAssetId: null,
  videoPictureIds: [],
  seconds: String(START_SECONDS),
  promptTyped: false,
}

// A draft with every field, the ones it has not set at their first values.
export function draftOf(draft: GenerateDraft): FullDraft
export function draftOf(draft: GenerateDraft | undefined): FullDraft | undefined
export function draftOf(draft: GenerateDraft | undefined): FullDraft | undefined {
  return draft && { ...DEFAULTS, ...draft }
}

export type GenerateDraftsState = {
  projectId: string | null
  drafts: Readonly<Record<string, GenerateDraft>>
  // The kind a layer's first draft starts with, kept until that draft is made.
  wanted: Readonly<Record<string, GenerateKind>>
  follow(projectId: string | null): void
  // Sets the first draft of a layer; a draft that is there already is kept.
  start(key: string, draft: GenerateDraft): void
  change(key: string, patch: Partial<GenerateDraft>): void
  wantKind(key: string, kind: GenerateKind): void
}

export const draftKey = (projectId: string, layerId: string) => `${projectId}/${layerId}`

const without = <T>(record: Readonly<Record<string, T>>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))

export const generateDrafts = createStore<GenerateDraftsState>((set, get) => ({
  projectId: null,
  drafts: {},
  wanted: {},
  follow(projectId) {
    if (projectId !== get().projectId) set({ projectId, drafts: {}, wanted: {} })
  },
  start(key, draft) {
    if (get().drafts[key]) return
    const kind = get().wanted[key]
    const made = kind === undefined ? draft : { ...draft, kind }
    set({ drafts: { ...get().drafts, [key]: made }, wanted: without(get().wanted, key) })
  },
  change(key, patch) {
    const held = get().drafts[key]
    if (!held) return
    set({ drafts: { ...get().drafts, [key]: { ...held, ...patch } } })
  },
  wantKind(key, kind) {
    if (get().drafts[key]) return
    set({ wanted: { ...get().wanted, [key]: kind } })
  },
}))
