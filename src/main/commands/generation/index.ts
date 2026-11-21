// The generation command domain (SPEC 12). Slice H adds generation.runImages; CU-6a adds
// generation.startVideo; the other generation commands keep their phases (SPEC 4.2 notes).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { generationRunImages } from './run-images'
import { generationStartVideo } from './start-video'

export function generationCommands(deps: CoreDeps): CommandHandler[] {
  return [generationRunImages(deps), generationStartVideo(deps)]
}
