// CW-8 (spec/phases/custom-workflows-slices.md, "CW-8", item 3; D-092, D-104): test:comfy
// case 9, a custom workflow on the real server, only with ADMAN_COMFY_CUSTOM=1 set in the
// terminal. It takes the shipped Flux 3 klein graph, gives its steps adman: titles here, and
// passes the text through checkWorkflowText and toCustomSpec, as a person's add and a run do.
// Then one picture, client level as cases 5 to 8, with the test-made picture as the
// reference. The graph has no size marks: the result takes the reference's shape at about
// 1 megapixel, the smallest the graph makes. One attempt; a failure is reported, not retried.
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'
import { toCustomSpec } from '@/main/providers/comfyui/custom/to-spec'
import { flux3KleinEditReferences } from '@/main/providers/comfyui/workflows/flux3'
import type { Graph } from '@/main/providers/comfyui/workflows/types'
import { MAX_PICTURE_BYTES } from '@/main/providers/picture-limits'
import type { CustomWorkflowId } from '@/shared/schemas/queries/comfy'
import {
  checkPicture,
  missingFor,
  runAndReport,
  sendPicture,
  type CaseKit,
  type CaseOutcome,
} from './case-steps'
import type { SentPicture } from './given-picture'
import { makeTestPicture, TEST_PICTURE_SIDE } from './test-picture'

const PROMPT = 'The same shapes and colours, drawn as a watercolour painting'

// The marks, by the slots of the shipped spec: prompt, seed, the one reference and the output.
const MARKS: Record<string, string> = {
  '6': 'adman: prompt',
  '9': 'adman: seed',
  '10': 'adman: ref1',
  '15': 'adman: output',
}

// The shipped graph as a person would export it from ComfyUI after marking its steps.
export function markedFluxText(): string {
  const graph = structuredClone(flux3KleinEditReferences.graph) as Graph
  for (const [node, title] of Object.entries(MARKS)) {
    const step = graph[node]
    if (!step) throw new Error('The shipped Flux graph has changed: a marked step is gone')
    step._meta = { title }
  }
  return JSON.stringify(graph)
}

// The checked text as the store would hold it, then as a run's WorkflowSpec.
export function markedFluxSpec() {
  const checked = checkWorkflowText(markedFluxText())
  if (!checked.ok) throw new Error(`The marked Flux graph was refused: ${checked.error.message}`)
  if (checked.data.job !== 'image_refs') throw new Error('The marked Flux graph is not image_refs')
  return toCustomSpec({
    format: 1,
    id: 'custom-0c8f1e2d3b4a' as CustomWorkflowId,
    name: 'Flux reference, marked',
    addedBy: 'user',
    addedAt: new Date().toISOString(),
    size: null,
    video: null,
    graph: checked.data.graph,
  })
}

// The spec names the test's own picture for this case, so ADMAN_COMFY_PICTURE is not read.
function testMade(): SentPicture {
  const side = TEST_PICTURE_SIDE
  return {
    kind: 'test-made',
    bytes: makeTestPicture(),
    type: 'image/png',
    width: side,
    height: side,
  }
}

export async function customCase(kit: CaseKit): Promise<CaseOutcome> {
  if (kit.env.ADMAN_COMFY_CUSTOM !== '1') {
    return { skip: 'ADMAN_COMFY_CUSTOM is not 1, so the custom workflow case does not run.' }
  }
  const spec = markedFluxSpec()
  kit.print(`Custom workflow: ${spec.job}, ${spec.needs.nodeClasses.length} node types`)
  const { skip, version } = await missingFor(kit, spec)
  if (skip) return { skip }
  const name = await sendPicture(kit, testMade())
  const values = { prompt: PROMPT, references: [name] }
  await runAndReport(kit, spec, version, values, MAX_PICTURE_BYTES, checkPicture(kit))
  return { done: true }
}
