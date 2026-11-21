// A wire job row for the campaign page tests (SPEC 3.3 job, SPEC 4.4 wire rows).
import type { JobRow } from '../../../../src/shared/schemas/rows/job'

export function jobRow(id: string, over: Partial<JobRow> = {}): JobRow {
  return {
    id,
    kind: 'image_generation',
    status: 'queued',
    campaignId: 'C1',
    variantId: 'V1',
    layerId: null,
    slot: 'subject-image',
    provider: 'gemini',
    model: null,
    request: { prompt: 'A can', referenceAssetIds: [], count: 2, width: 1080, height: 1080 },
    remoteJobId: null,
    result: null,
    errorKind: null,
    progress: null,
    paidCalls: 0,
    seenAt: null,
    startedBy: 'user',
    errorReason: null,
    createdAt: '2026-11-21T00:00:00.000Z',
    updatedAt: '2026-11-21T00:00:00.000Z',
    ...over,
  }
}
