// The subject command domain (SPEC 12; SPEC 14, slice C).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { subjectCreate, subjectDelete, subjectUpdate } from './subject'

export function subjectCommands(deps: CoreDeps): CommandHandler[] {
  return [subjectCreate(deps), subjectUpdate(), subjectDelete()]
}
