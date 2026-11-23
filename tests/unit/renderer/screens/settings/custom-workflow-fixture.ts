// Made-up custom workflows as comfy.getInfo lists them (D-104), for the CW-4 Settings tests.
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { CUSTOM_SIZE_DEFAULTS, CUSTOM_VIDEO_DEFAULT } from '@/shared/comfy/custom-workflow'
import { workflow } from './comfy-fixture'

type Custom = NonNullable<WorkflowInfo['custom']>

export function customWorkflow(
  overrides: Partial<WorkflowInfo> = {},
  custom: Partial<Custom> = {},
): WorkflowInfo {
  return workflow({
    id: 'custom-0a1b2c3d4e5f',
    label: 'Studio portrait',
    job: 'image',
    status: 'custom',
    model: { label: 'Custom workflow', mainFile: 'custom ComfyUI workflow' },
    size: CUSTOM_SIZE_DEFAULTS.image,
    licence: { name: 'Not known', url: '', commercialNote: null },
    offered: true,
    isDefault: false,
    custom: { addedBy: 'user', addedAt: '2026-11-20T09:30:00.000Z', nodeCount: 12, ...custom },
    ...overrides,
  })
}

export const PORTRAIT = customWorkflow()

export const TIDE_CLIP = customWorkflow(
  {
    id: 'custom-1a2b3c4d5e6f',
    label: 'Tide clip',
    job: 'video',
    videoStart: { firstFrame: false, references: false },
    size: CUSTOM_SIZE_DEFAULTS.video,
    video: { ...CUSTOM_VIDEO_DEFAULT, fps: 16, maxMs: 8_000 },
  },
  { addedBy: 'agent', nodeCount: 31, addedAt: '2026-11-21T14:05:00.000Z' },
)

export const HARBOUR_FIRST = customWorkflow(
  {
    id: 'custom-2a3b4c5d6e7f',
    label: 'Harbour from a first frame',
    job: 'video',
    videoStart: { firstFrame: true, references: false },
    size: CUSTOM_SIZE_DEFAULTS.video,
    video: CUSTOM_VIDEO_DEFAULT,
  },
  { nodeCount: 1, addedAt: '2026-11-22T08:00:00.000Z' },
)

// n custom workflows with made-up names, for the limit.
export function manyWorkflows(n: number): WorkflowInfo[] {
  return Array.from({ length: n }, (_, i) =>
    customWorkflow({
      id: `custom-${i.toString(16).padStart(12, '0')}`,
      label: `Poster look ${i + 1}`,
    }),
  )
}
