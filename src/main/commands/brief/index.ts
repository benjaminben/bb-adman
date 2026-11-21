// The brief command domain (SPEC 12; SPEC 14, slice C).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { briefParse } from './parse'
import { briefExtract } from './extract'

export function briefCommands(deps: CoreDeps): CommandHandler[] {
  return [briefParse(), briefExtract(deps)]
}
