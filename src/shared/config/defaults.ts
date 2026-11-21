// Single owner of default sizes, duration and frame rate (SPEC 3.1, 3.3).
import type { CampaignSize } from '../schemas/commands/campaign'

export const DEFAULT_FPS = 30

// SPEC 4.2 [1.9]: the most pictures one generation.runImages run may ask for. Each picture
// is one paid call.
export const MAX_IMAGES_PER_RUN = 8

export type ReadyMadeSize = CampaignSize & { selectedByDefault: boolean }

// SPEC 3.3 ready-made sizes [FR-026, FR-032, FR-247]. The one list; parseSize reads it.
export const READY_MADE_SIZES: readonly ReadyMadeSize[] = [
  { label: '1x1', width: 1080, height: 1080, selectedByDefault: true },
  { label: '9x16', width: 1080, height: 1920, selectedByDefault: true },
  { label: '16x9', width: 1920, height: 1080, selectedByDefault: true },
  { label: '4x5', width: 1080, height: 1350, selectedByDefault: false },
]
