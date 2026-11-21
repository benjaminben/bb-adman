// The translation job kind (spec/phases/phase-06.md, design addition 2; attached [D-036]).
// Stub (P6-1): fails every job until P6-6 replaces the body. It makes no provider call and
// writes nothing.
import type { JobKindHandler } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'
import type { TranslationJobResult } from '@/shared/schemas/jobs/translation'

async function runTranslationJob(): Promise<TranslationJobResult> {
  throw new ProviderFailure({ kind: 'other', detail: 'Translate is not built yet' })
}

export function translationKind(): JobKindHandler {
  return { kind: 'translation', run: runTranslationJob }
}
