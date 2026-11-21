// The generation command domain (SPEC 12). Slice H adds generation.runImages; the other
// generation commands keep their phases (SPEC 4.2 notes).
import type { CoreDeps } from '../../core-deps'
import type { CommandHandler } from '../types'
import { generationRunImages } from './run-images'

export function generationCommands(deps: CoreDeps): CommandHandler[] {
  return [generationRunImages(deps)]
}
