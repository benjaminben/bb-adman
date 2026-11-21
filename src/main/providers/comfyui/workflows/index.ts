// The shipped workflows (SPEC 6.10.4) [REQ: FR-258, FR-278] (security class): the only
// workflows the app can send. In the fixed order of WORKFLOW_IDS.
import type { WorkflowSpec } from './types'
import { mossEditReferences, mossExtend, mossTextToImage } from './moss'
import { h3ImageToVideo, h3ReferenceToVideo, h3TextToVideo } from './h3'
import { flux3KleinEditReferences } from './flux3'
import { birefnetCutout } from './birefnet'

export const WORKFLOWS: readonly WorkflowSpec[] = [
  mossTextToImage,
  mossEditReferences,
  mossExtend,
  h3TextToVideo,
  h3ImageToVideo,
  h3ReferenceToVideo,
  flux3KleinEditReferences,
  birefnetCutout,
]

// [1.45] B-3: a draft's node classes are stand-ins, so no check compares one.
export function withoutDrafts(list: readonly WorkflowSpec[]): readonly WorkflowSpec[] {
  return list.filter((w) => w.status !== 'draft')
}

// The one list comfy.check and every run hand to the check, so the 60 s memory of an
// origin always holds the same workflows (1.45 B-3).
export const NON_DRAFT_WORKFLOWS: readonly WorkflowSpec[] = withoutDrafts(WORKFLOWS)
