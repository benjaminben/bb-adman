// SPEC 6.1 items 7 and 9 [1.26, 1.28, 1.31], security class: one pass over a parsed YAML
// document, before it becomes data. It refuses any alias, any node with an anchor (also when
// no alias uses it), any key that is not a single value, and a mapping with a plain key
// given twice (the library's own === comparison, which never calls two NaN keys equal and
// keeps 1 and "1" apart). `visit` uses only the most specific visitor for a node, so each
// kind of node has its own anchor check.
import { visit, isScalar, type Document, type Node, type YAMLMap } from 'yaml'

function repeatsKey(map: YAMLMap): boolean {
  const seen = new Set<unknown>()
  for (const pair of map.items) {
    if (!isScalar(pair.key) || Number.isNaN(pair.key.value)) continue
    if (seen.has(pair.key.value)) return true
    seen.add(pair.key.value)
  }
  return false
}

export function passesYamlWalk(doc: Document): boolean {
  let passes = true
  const refuse = (): symbol => {
    passes = false
    return visit.BREAK
  }
  const anchored = (_key: unknown, node: Node): symbol | undefined =>
    node.anchor === undefined ? undefined : refuse()
  visit(doc, {
    Alias: refuse,
    Scalar: anchored,
    Seq: anchored,
    Map(key, map) {
      return anchored(key, map) ?? (repeatsKey(map) ? refuse() : undefined)
    },
    Pair(_key, pair) {
      return pair.key === null || isScalar(pair.key) ? undefined : refuse()
    },
  })
  return passes
}
