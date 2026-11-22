// A stored custom workflow made from a fixture, for the tests (D-104).
import type { StoredCustomWorkflow } from '@/main/providers/comfyui/custom/stored'
import { fixtureText, type CustomFixture } from '../../../../../fixtures/comfy-custom/load'

export function storedFrom(
  name: CustomFixture,
  extra: Partial<StoredCustomWorkflow> = {},
): StoredCustomWorkflow {
  const video = name.startsWith('video')
  return {
    format: 1,
    id: 'custom-0123456789ab',
    name: 'Lighthouse pictures',
    addedBy: 'user',
    addedAt: '2026-11-22T10:00:00.000Z',
    size: null,
    video: video ? { fps: 16, maxMs: 5_000, frameStep: 4, frameOffset: 1 } : null,
    graph: JSON.parse(fixtureText(name)),
    ...extra,
  }
}
