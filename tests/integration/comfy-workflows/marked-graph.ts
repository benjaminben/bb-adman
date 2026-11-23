// CW-8 (spec/comfyui-custom.md "Security", rule 2): the picture fixture with a marker string
// in every text it holds: each node ID, class name, input name, text value and title. Mark
// titles name their input with = so the marker is in them too, and the output step also
// carries a second seed mark for the same reason. It still passes the file checks. Not a
// test file.
import { fixtureText } from '../../fixtures/comfy-custom/load'

export const MARKER = 'QX7MARKER'

type Node = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } }

const id = (key: string) => `${MARKER}-${key}`
const input = (name: string) => `${MARKER}_${name}`

const isLink = (v: unknown): v is [string, number] =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'number'

function markValue(value: unknown): unknown {
  if (isLink(value)) return [id(value[0]), value[1]]
  if (typeof value === 'string') return `${MARKER} ${value}`
  return value
}

// "adman: seed" becomes "adman: seed=QX7MARKER_seed"; other titles gain the marker in front.
function markTitle(title: string, inputs: Record<string, unknown>): string {
  if (!title.startsWith('adman:')) return `${MARKER} ${title}`
  const words = title.slice(6).trim().split(/\s+/)
  if (words.includes('output')) return `adman: output seed=${input('seed2')}`
  const named = words.map((w) => {
    const name = w === 'prompt' ? 'text' : w
    if (!(name in inputs)) throw new Error(`the fixture has no input ${name}`)
    return `${w}=${input(name)}`
  })
  return `adman: ${named.join(' ')}`
}

export type MarkOptions = {
  // A node of this extra class, fed from the decoder, so a run can lack one node type.
  extraClass?: string
  // The output step loses its mark: the graph parses but fails a later file check.
  noOutput?: boolean
}

export function markedGraphValue(opts: MarkOptions = {}): Record<string, Node> {
  const source = JSON.parse(fixtureText('picture')) as Record<string, Node>
  const graph: Record<string, Node> = {}
  for (const [key, node] of Object.entries(source)) {
    const inputs: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(node.inputs)) inputs[input(name)] = markValue(value)
    let title = markTitle(node._meta?.title ?? '', node.inputs)
    if (title.startsWith('adman: output')) {
      inputs[input('seed2')] = 7
      if (opts.noOutput) title = `${MARKER} output`
    }
    graph[id(key)] = { class_type: `${MARKER}${node.class_type}`, inputs, _meta: { title } }
  }
  if (opts.extraClass) {
    graph[id('extra')] = {
      class_type: opts.extraClass,
      inputs: { [input('images')]: [id('8'), 0], [input('note')]: `${MARKER} note` },
      _meta: { title: `${MARKER} extra` },
    }
  }
  return graph
}

export const markedGraph = (opts: MarkOptions = {}) => JSON.stringify(markedGraphValue(opts))

// The ID of the marked output step, for a stand-in history entry.
export const MARKED_OUTPUT = id('9')

// A canvas-format file with the marker, refused at the third file check.
export const markedCanvas = () =>
  JSON.stringify({ nodes: [{ title: MARKER, type: MARKER }], links: [], extra: { [MARKER]: 1 } })
