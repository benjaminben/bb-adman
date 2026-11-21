// The shipped workflows (SPEC 6.10.4) [REQ: FR-258, FR-278] (security class): the only
// workflows the app can send. In the fixed order of WORKFLOW_IDS.
import type { WorkflowSpec } from './types'
import { mossEditReferences, mossExtend, mossTextToImage } from './moss'
import { h3ImageToVideo, h3ReferenceToVideo, h3TextToVideo } from './h3'

export const WORKFLOWS: readonly WorkflowSpec[] = [
  mossTextToImage,
  mossEditReferences,
  mossExtend,
  h3TextToVideo,
  h3ImageToVideo,
  h3ReferenceToVideo,
]
