// The brief command domain (SPEC 12; SPEC 14, slice C).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { briefParse } from './parse'

export function briefCommands(_deps: CoreDeps): CommandHandler[] {
  return [briefParse()]
}
