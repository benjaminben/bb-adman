// The generative_fill job kind (spec/links-and-sync.md "Generative fill"; attached [D-036]).
// Stub (P5-1): fails every job until P5-8 replaces the body. It makes no provider call and
// stores nothing.
import type { JobKindHandler } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'
import type { GenerativeFillJobResult } from '@/shared/schemas/jobs/generative-fill'

async function runGenerativeFillJob(): Promise<GenerativeFillJobResult> {
  throw new ProviderFailure({ kind: 'other', detail: 'Generative fill is not built yet' })
}

export function generativeFillKind(): JobKindHandler {
  return { kind: 'generative_fill', run: runGenerativeFillJob }
}
