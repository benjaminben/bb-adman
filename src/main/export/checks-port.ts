// The export's checks (spec/phases/phase-08.md "Interfaces with other phases", ExportChecks;
// "Export run", the warnings gate and the job). run gives Phase 6's six results for each ad and
// writes nothing: the gate runs it in export.run's prepare step, which may not write. store
// saves the results the job ran, with ranBy 'export', as variant_check rows.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { storedJson } from '@/main/db/rows'
import { readCheckInput } from '@/main/checks/read-input'
import { runAllChecks } from '@/shared/checks/run-all'
import type { ReportCheck } from '@/shared/schemas/report'
import { AppError } from '@/shared/schemas/result'
import type { ExportChecks } from './types'

// The rev each result was made from, kept beside the map run gave, so store writes the rev the
// results describe, not one an edit moved on since.
const revsOf = new WeakMap<Map<string, ReportCheck[]>, Map<string, number>>()

// An ad deleted since it was chosen has no results; the job then marks it deleted.
function checkOne(project: ProjectHandle, variantId: string) {
  try {
    const { variant, input } = readCheckInput(project.db, variantId)
    return { rev: variant.rev, results: runAllChecks(input) }
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') return null
    throw e
  }
}

// Writes a row only while its variant is there: one deleted since run has none.
const UPSERT = `INSERT INTO variant_check (variant_id, checked_rev, ran_at, ran_by, results)
  SELECT id, ?, ?, ?, ? FROM variant WHERE id = ?
  ON CONFLICT (variant_id) DO UPDATE SET checked_rev = excluded.checked_rev,
    ran_at = excluded.ran_at, ran_by = excluded.ran_by, results = excluded.results`

export function createExportChecks(deps: () => CoreDeps): ExportChecks {
  return {
    checksRun: true,
    async run(project, variantIds) {
      const results = new Map<string, ReportCheck[]>()
      const revs = new Map<string, number>()
      for (const id of new Set(variantIds)) {
        const checked = checkOne(project, id)
        results.set(id, checked?.results ?? [])
        if (checked) revs.set(id, checked.rev)
      }
      revsOf.set(results, revs)
      return results
    },
    store(project, results, ranBy) {
      const revs = revsOf.get(results)
      if (!revs) return
      const ranAt = deps().now().toISOString()
      const upsert = project.db.prepare(UPSERT)
      project.db.transaction(() => {
        for (const [id, rev] of revs) {
          const stored = storedJson('variant_check', 'results', results.get(id) ?? [])
          upsert.run(rev, ranAt, ranBy, stored, id)
        }
      })()
    },
  }
}
