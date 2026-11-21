// SPEC 6.11.1 [1.38]: the options a kind handler hands to a provider's generate or extend:
// the job's signal and its onProgress, and nothing else.
import type { JobRunContext } from './types'
import type { RunOptions } from '@/main/providers/types'

export function runOptions(jc: JobRunContext): RunOptions {
  return { signal: jc.signal, onProgress: jc.onProgress }
}
