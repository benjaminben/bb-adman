// F-8 [A-56]: the referenceAssetIds list of a run, written once for the commands, the agent
// tools and the job requests. At most MAX_REFERENCES_PER_RUN pictures.
import { z } from 'zod'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'

export const tooManyReferencesLine = `A run takes at most ${MAX_REFERENCES_PER_RUN} reference pictures.`

export const referenceIds = z
  .array(z.string().min(1))
  .max(MAX_REFERENCES_PER_RUN, tooManyReferencesLine)
