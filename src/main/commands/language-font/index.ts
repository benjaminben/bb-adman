// The language-font command domain (spec/phases/phase-06.md, design addition 6, A-166).
// P6-9 replaces the body of set-fonts.ts; this list does not change.
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { layerSetFonts } from './set-fonts'

export function languageFontCommands(deps: CoreDeps): CommandHandler[] {
  return [layerSetFonts(deps)]
}
