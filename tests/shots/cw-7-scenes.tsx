// The scene of cw-7.shots.ts, picture 535: the run row's failure for a custom ComfyUI workflow
// the server lacks one node type for. No screen can start a run of a custom workflow until the
// run dialog's picker (CW-5) is merged, so the real RunFailure is drawn here, in a column as
// wide as the Activity panel, over the built app's page with its own window.api. The row holds
// what the main process stores for that failure: an empty list and the count. Made-up content.
import './cw-7-jitless'
import { createRoot, type Root } from 'react-dom/client'
import { AppProvider } from '@/renderer/app/app-context'
import { createAppStore } from '@/renderer/stores/app-store'
import { RunFailure } from '@/renderer/ui/run-failure'
import type { AdmanApi } from '@/shared/schemas/api'
import type { JobRow } from '@/shared/schemas/rows/job'

const ROW: JobRow = {
  id: '01JD7CW7000000000000000001',
  kind: 'image_generation',
  status: 'failed',
  campaignId: 'C1',
  variantId: 'V1',
  layerId: null,
  slot: 'background',
  provider: 'comfyui',
  model: null,
  request: {
    prompt: 'A harbour at dawn, fishing boats, soft fog',
    referenceAssetIds: [],
    count: 1,
    width: 1080,
    height: 1350,
    workflowId: 'custom-0a1b2c3d4e5f',
  },
  remoteJobId: null,
  result: { missing: [], missingCount: 1 },
  errorKind: 'other',
  progress: null,
  paidCalls: 0,
  seenAt: null,
  startedBy: 'user',
  errorReason: 'missing_items',
  createdAt: '2026-11-22T09:10:00.000Z',
  updatedAt: '2026-11-22T09:10:04.000Z',
}

let root: Root | null = null

export function show(): void {
  const api = (window as unknown as { api: AdmanApi }).api
  root?.unmount()
  document.body.replaceChildren()
  Object.assign(document.body.style, { background: 'var(--color-page)', margin: '0' })
  const holder = document.createElement('div')
  Object.assign(holder.style, { padding: 'var(--space-6)', width: 'var(--activity-width)' })
  document.body.append(holder)
  root = createRoot(holder)
  root.render(
    <AppProvider api={api} store={createAppStore(api)}>
      <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-muted)' }}>
        Harbour flare · ComfyUI
      </p>
      <RunFailure row={ROW} projectId="P1" provider={undefined} providerLabel="ComfyUI" />
    </AppProvider>,
  )
}
