// The job kind handlers the runner knows (SPEC 3.6). Each slice adds its own line.
import type { JobKindHandler } from '@/main/jobs/types'
import { imageGenerationKind } from './image-generation'
import { videoGenerationKind } from './video-generation'

export const jobKindHandlers: JobKindHandler[] = [imageGenerationKind(), videoGenerationKind()]
