// subject.list (spec/phases/phase-10.md, "Design additions", A-235). Both actors. Stub (P10-1):
// checks its input, then refuses before it reads the project, until P10-2 replaces the body.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { subjectListInput } from '@/shared/schemas/queries/subject'
import { AppError } from '@/shared/schemas/result'

function subjectList(): QueryFn {
  return (raw) => {
    if (!subjectListInput.safeParse(raw).success) {
      throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    }
    throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
  }
}

export function subjectListQueries(_deps: CoreDeps): Record<string, QueryFn> {
  return { 'subject.list': subjectList() }
}
