// spec/phases/phase-06.md, design addition 5, "Storing and reading": runs the engine on each
// variant and upserts its variant_check row, with checked_rev the variant's rev now. Callers:
// check.run (with the actor) and, from Phase 8, export (with 'export'). Runs inside the
// caller's transaction; changes no rev. Only the engine makes a row's results.
import type { ProjectContext } from '@/main/commands/types'
import { storedJson } from '@/main/db/rows'
import { runAllChecks } from '@/shared/checks/run-all'
import type { CheckRunReply } from '@/shared/schemas/commands/check'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'
import { readCheckInput } from './read-input'

export type CheckedVariant = CheckRunReply['variants'][number]

// Every ID is read before anything is written, so one unknown ID refuses the whole run.
export function runChecksFor(
  ctx: ProjectContext,
  variantIds: string[],
  ranBy: VariantCheckRow['ranBy'],
  ranAt: string,
): CheckedVariant[] {
  const db = ctx.project.db
  const inputs = [...new Set(variantIds)].map((id) => readCheckInput(db, id))
  const upsert = db.prepare(
    `INSERT INTO variant_check (variant_id, checked_rev, ran_at, ran_by, results)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (variant_id) DO UPDATE SET checked_rev = excluded.checked_rev,
       ran_at = excluded.ran_at, ran_by = excluded.ran_by, results = excluded.results`,
  )
  return inputs.map(({ variant, input }) => {
    const results = runAllChecks(input)
    upsert.run(
      variant.id,
      variant.rev,
      ranAt,
      ranBy,
      storedJson('variant_check', 'results', results),
    )
    ctx.changes.touch('variant_check', { variantId: variant.id })
    return { variantId: variant.id, checkedRev: variant.rev, results }
  })
}
