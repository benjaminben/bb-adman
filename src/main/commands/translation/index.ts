// The translation command domain (spec/phases/phase-06.md, design additions 1 and 2).
// translation.write and translation.restore are system commands. Later slices replace the
// bodies; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { translationApprove } from './approve'
import { translationExportSheet } from './export-sheet'
import { translationPropose } from './propose'
import { translationRestore } from './restore'
import { translationSet } from './set'
import { translationWrite } from './write'

export function translationCommands(deps: CoreDeps): CommandHandler[] {
  return [
    translationPropose(deps),
    translationSet(deps),
    translationApprove(deps),
    translationExportSheet(deps),
    translationWrite(deps),
    translationRestore(deps),
  ]
}
