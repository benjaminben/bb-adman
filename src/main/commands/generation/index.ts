// The generation command domain (SPEC 12). Slice H adds generation.runImages; CU-6a adds
// generation.startVideo; the other generation commands keep their phases (SPEC 4.2 notes).
import type { CoreDeps } from '@/main/core-deps'
import type { CommandHandler } from '@/main/commands/types'
import { generationRunImages } from './run-images'
import { generationStartVideo } from './start-video'
import { generationProposeLayout } from './propose-layout'
import { generationCopyOptions } from './copy-options'
import { generationCutOut } from './cut-out'

export function generationCommands(deps: CoreDeps): CommandHandler[] {
  return [
    generationRunImages(deps),
    generationStartVideo(deps),
    generationProposeLayout(deps),
    generationCopyOptions(deps),
    generationCutOut(deps),
  ]
}
