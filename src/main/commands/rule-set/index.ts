// The rule-set command domain (SPEC 12; SPEC 14, slice C).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { ruleSetCopyFrom, ruleSetUpdate } from './rule-set'

export function ruleSetCommands(_deps: CoreDeps): CommandHandler[] {
  return [ruleSetUpdate(), ruleSetCopyFrom()]
}
