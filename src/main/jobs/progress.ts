// SPEC 6.11.1, 14 slice D amended: a provider's onProgress is written into the job
// (`progress`, and `result.stage`, `result.queuePosition` while running). The frozen
// JobRunContext has only progress(fraction), so the runner keeps one reporter per context.
import type { JobRunContext } from './types'
import type { RunOptions, RunProgress } from '../providers/types'

const reporters = new WeakMap<JobRunContext, (p: RunProgress) => void>()

export function setReporter(jc: JobRunContext, report: (p: RunProgress) => void): void {
  reporters.set(jc, report)
}

export function reportProgress(jc: JobRunContext, p: RunProgress): void {
  reporters.get(jc)?.(p)
}

// The options a kind handler hands to generate or extend: the job's signal and its reporter.
export function runOptions(jc: JobRunContext): RunOptions {
  return { signal: jc.signal, onProgress: (p) => reportProgress(jc, p) }
}
