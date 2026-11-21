// SPEC 14 1.41 CU-5a, 1.43 K-2: what test:comfy may print from the server. For a refused
// graph: the refusal's type, message and details, and for each node error the node ID, the
// class_type from the app's own graph, the input name, type, message and details. For a run
// that failed: the exception's type and message. Never the traceback, never a received value.
// The printer removes control characters, hides the address and cuts each line.
import type { RunMessage } from '../../src/main/providers/comfyui/answers'
import type { ServerRefusal } from '../../src/main/providers/comfyui/refusal'
import type { Graph } from '../../src/main/providers/comfyui/workflows/types'

const present = (pairs: Array<[string, string | undefined]>) =>
  pairs.flatMap(([label, text]) => (text === undefined ? [] : [`${label}${text}`]))

export function refusalLines(refusal: ServerRefusal, graph: Graph): string[] {
  const lines = present([
    ['Refused: ', refusal.type],
    ['Message: ', refusal.message],
    ['Details: ', refusal.details],
  ])
  for (const node of refusal.nodes) {
    const classType = graph[node.nodeId]?.class_type ?? "not in the app's graph"
    for (const e of node.errors) {
      const input = e.inputName === undefined ? '' : `, input ${e.inputName}`
      lines.push(`Node ${node.nodeId} (${classType})${input}: ${e.type ?? 'no type given'}`)
      lines.push(
        ...present([
          ['  Message: ', e.message],
          ['  Details: ', e.details],
        ]),
      )
    }
  }
  return lines
}

export function runErrorLines(messages: readonly RunMessage[]): string[] {
  const errors = messages.filter((m) => m.type === 'execution_error')
  if (errors.length === 0) return ['Run error: the server gave no exception']
  return errors.flatMap((m) => [
    `Run error: ${m.exceptionType ?? 'no type given'}`,
    ...present([['  Message: ', m.exceptionMessage]]),
  ])
}
