// spec/comfyui-custom.md "Marks", fewer pictures than ref marks (D-104): a custom workflow
// runs with 1 picture up to its number of ref marks. For a run with fewer, the unused picture
// steps are taken out of the graph that is sent. What goes is worked out here, from the graph
// alone:
//   - the unused ref steps go;
//   - a step whose every link came from a step that goes, goes too (a resize after a loader);
//   - on a step that stays, each input linked to a step that goes is deleted.
// A count is offered only when taking the steps out leaves every other marked step in place;
// below the lowest such count the run is refused before anything is sent. Pure.
import type { Graph, Pointer, WorkflowSlots } from '@/main/providers/comfyui/workflows/types'
import { isLink } from './links'
import type { Marks } from './marks'

type Drop = { nodes: string[]; inputs: Pointer[] }
type ReferenceSlots = Pick<WorkflowSlots, 'references' | 'minReferences'>

const NOTHING: Drop = { nodes: [], inputs: [] }

const linksOf = (graph: Graph, id: string) => Object.values(graph[id]?.inputs ?? {}).filter(isLink)

// What goes when the ref steps in `unused` get no picture.
function dropFor(graph: Graph, unused: string[]): Drop {
  const gone = new Set(unused)
  for (let grew = true; grew;) {
    grew = false
    for (const id of Object.keys(graph)) {
      if (gone.has(id)) continue
      const links = linksOf(graph, id)
      if (links.length === 0 || !links.every(([from]) => gone.has(from))) continue
      gone.add(id)
      grew = true
    }
  }
  const inputs: Pointer[] = []
  for (const [id, node] of Object.entries(graph)) {
    if (gone.has(id)) continue
    for (const [input, value] of Object.entries(node.inputs)) {
      if (isLink(value) && gone.has(value[0])) inputs.push({ node: id, input })
    }
  }
  return { nodes: [...gone], inputs }
}

// Every step a mark names apart from the ref steps: none of them may go.
function keptSteps(marks: Marks): Set<string> {
  const pointers = [marks.prompt, ...marks.seed, marks.width, marks.height, marks.frames]
  const ids = pointers.flatMap((p) => (p ? [p.node] : []))
  return new Set([...ids, marks.output])
}

export function referenceSlots(graph: Graph, marks: Marks): ReferenceSlots {
  const steps = marks.references.map((r) => r.node)
  if (steps.length === 0) return {}
  const kept = keptSteps(marks)
  const drops: Drop[] = steps.map(() => NOTHING)
  let min = steps.length
  // From the last picture down: slot k unused means every later slot is unused too.
  for (let k = steps.length - 1; k >= 1; k -= 1) {
    const drop = dropFor(graph, steps.slice(k))
    const stays = steps.slice(0, k)
    if (drop.nodes.some((id) => kept.has(id) || stays.includes(id))) break
    drops[k] = drop
    min = k
  }
  return {
    references: marks.references.map((image, k) => ({
      image,
      dropWhenUnused: drops[k] ?? NOTHING,
    })),
    minReferences: min,
  }
}
