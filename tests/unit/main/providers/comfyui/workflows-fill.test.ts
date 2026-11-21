import { describe, it, expect } from 'vitest'
import { fillWorkflow, type FillValues } from '../../../../../src/main/providers/comfyui/fill'
import { WORKFLOWS } from '../../../../../src/main/providers/comfyui/workflows'
import type {
  Graph,
  Pointer,
  WorkflowSpec,
} from '../../../../../src/main/providers/comfyui/workflows/types'

const PROMPT_ID = '6f1c2d3e-4b5a-4c6d-8e7f-90a1b2c3d4e5'

// Every value a spec's slots ask for, with `count` reference pictures.
function valuesFor(spec: WorkflowSpec, count: number): FillValues {
  const s = spec.slots
  return {
    prompt: 'a test prompt',
    ...(s.width && { width: 1024, height: 1024 }),
    ...(s.references && { references: Array.from({ length: count }, (_, i) => `ref-${i}.png`) }),
    ...(s.firstFrame && { firstFrame: 'first.png' }),
    ...(s.frames && { frames: 57 }),
    ...(s.outputPrefix && { promptId: PROMPT_ID }),
    ...(s.pad && { pad: { left: 8, top: 16, right: 24, bottom: 32 } }),
  }
}

function pointed(spec: WorkflowSpec): Pointer[] {
  const s = spec.slots
  return [
    s.prompt,
    ...s.seed,
    ...[s.width, s.height, s.firstFrame, s.frames, s.outputPrefix].filter(
      (p): p is Pointer => p !== undefined,
    ),
    ...(s.references ?? []).map((r) => r.image),
    ...(s.pad ? Object.values(s.pad) : []),
  ]
}

// The inputs that differ between two graphs, as "node.input", and the nodes in only one.
function differences(a: Graph, b: Graph) {
  const inputs: string[] = []
  const nodes: string[] = []
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id]
    const y = b[id]
    if (!x || !y) {
      nodes.push(id)
      continue
    }
    expect(y.class_type).toBe(x.class_type)
    for (const input of new Set([...Object.keys(x.inputs), ...Object.keys(y.inputs)])) {
      if (JSON.stringify(x.inputs[input]) !== JSON.stringify(y.inputs[input])) {
        inputs.push(`${id}.${input}`)
      }
    }
  }
  return { inputs: inputs.sort(), nodes: nodes.sort() }
}

function links(graph: Graph): string[] {
  return Object.values(graph).flatMap((n) =>
    Object.values(n.inputs).flatMap((v) =>
      Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' ? [v[0]] : [],
    ),
  )
}

const counts = (spec: WorkflowSpec): number[] => {
  const slots = spec.slots.references?.length ?? 0
  const min = spec.slots.references ? (spec.slots.minReferences ?? 1) : 0
  return Array.from({ length: slots - min + 1 }, (_, i) => min + i)
}

const cases = WORKFLOWS.flatMap((w) => counts(w).map((n) => [w.id, n, w] as const))

describe('fillWorkflow on the shipped files [SPEC 6.10.4, 14 1.39]', () => {
  it.each(cases)('%s with %i picture(s): every link points at a node that is there', (_, n, w) => {
    const g = fillWorkflow(w, valuesFor(w, n))
    for (const target of links(g)) expect(g[target], target).toBeDefined()
    expect(g[w.slots.outputNode]).toBeDefined()
  })

  it.each(cases)(
    '%s with %i picture(s): removes exactly the declared nodes and inputs',
    (_, n, w) => {
      const g = fillWorkflow(w, valuesFor(w, n))
      const unused = (w.slots.references ?? []).slice(n)
      const droppedNodes = unused.flatMap((r) => r.dropWhenUnused.nodes).sort()
      const droppedInputs = unused.flatMap((r) => r.dropWhenUnused.inputs)
      expect(
        Object.keys(w.graph)
          .filter((id) => !g[id])
          .sort(),
      ).toEqual(droppedNodes)
      for (const p of droppedInputs) {
        if (g[p.node]) expect(g[p.node]?.inputs).not.toHaveProperty(p.input)
      }
      expect(Object.keys(g).every((id) => w.graph[id])).toBe(true)
    },
  )

  it.each(WORKFLOWS.map((w) => [w.id, w] as const))(
    '%s with every slot used: differs from the shipped graph only at the pointed inputs',
    (_, w) => {
      const all = w.slots.references?.length ?? 0
      const g = fillWorkflow(w, valuesFor(w, all))
      const diff = differences(w.graph, g)
      expect(diff.nodes).toEqual([])
      const allowed = new Set(pointed(w).map((p) => `${p.node}.${p.input}`))
      for (const d of diff.inputs) expect(allowed.has(d), d).toBe(true)
    },
  )

  it.each(WORKFLOWS.map((w) => [w.id, w] as const))(
    '%s: two fills give different seeds',
    (_, w) => {
      const all = w.slots.references?.length ?? 0
      const seed = w.slots.seed[0]!
      const one = fillWorkflow(w, valuesFor(w, all))[seed.node]?.inputs[seed.input]
      const two = fillWorkflow(w, valuesFor(w, all))[seed.node]?.inputs[seed.input]
      expect(one).not.toBe(two)
    },
  )
})
