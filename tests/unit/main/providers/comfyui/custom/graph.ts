// Small made-up graphs for the custom workflow tests (D-104). Node class names are invented
// where a real one is not needed.
import type { Graph, GraphNode } from '@/main/providers/comfyui/workflows/types'

export function node(classType: string, inputs: Record<string, unknown>, title?: string) {
  const made: GraphNode = { class_type: classType, inputs }
  return title === undefined ? made : { ...made, _meta: { title } }
}

// The fewest marks a workflow needs: prompt, seed and output.
export function basePicture(): Graph {
  return {
    '1': node('MadeUpTextBox', { text: 'a cat' }, 'adman: prompt'),
    '2': node('MadeUpSampler', { seed: 5, steps: 20, positive: ['1', 0] }, 'adman: seed'),
    '3': node('MadeUpPreview', { images: ['2', 0] }, 'adman: output'),
  }
}
