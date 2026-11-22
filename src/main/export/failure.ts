// One ad's failure in an export (spec/phases/phase-08.md "Export run"). The sentence goes into
// the report as it is, so it is always one of the fixed sentences in messages.ts or built from
// one; an error the export did not make never gives its own text, which could hold a path.
import { AD_FAILURES } from '@/shared/export/messages'

export class ExportFailure extends Error {
  readonly sentence: string

  constructor(sentence: string) {
    super(sentence)
    this.name = 'ExportFailure'
    this.sentence = sentence
  }
}

const FIXED = new Set<string>(Object.values(AD_FAILURES))

// The sentence for an ad that failed with `e`: an ExportFailure's own, a plain error whose text
// is one of the fixed sentences (the video port's), otherwise `fallback`.
export function failureSentence(e: unknown, fallback: string): string {
  if (e instanceof ExportFailure) return e.sentence
  if (e instanceof Error && FIXED.has(e.message)) return e.message
  return fallback
}
