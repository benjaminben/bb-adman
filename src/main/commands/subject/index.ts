// The subject command domain (SPEC 12; SPEC 14, slice C).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { subjectCreate, subjectDelete, subjectUpdate } from './subject'

export function subjectCommands(deps: CoreDeps): CommandHandler[] {
  return [subjectCreate(deps), subjectUpdate(), subjectDelete()]
}
