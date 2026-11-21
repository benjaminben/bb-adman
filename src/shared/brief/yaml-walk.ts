// SPEC 6.1 item 7 [1.26, 1.28], security class: one pass over a parsed YAML document,
// before it becomes data. It refuses a mapping with a plain key given twice (the library's
// own === comparison, which never calls two NaN keys equal and keeps 1 and "1" apart), and
// a file with more than MAX_BRIEF_ALIASES alias nodes. `visit` reaches each node once and
// does not follow aliases.
import { visit, isScalar, type Document } from 'yaml'
import { MAX_BRIEF_ALIASES } from '../config/brief-limits'

export function passesYamlWalk(doc: Document): boolean {
  let aliases = 0
  let passes = true
  visit(doc, {
    Alias() {
      aliases += 1
      if (aliases <= MAX_BRIEF_ALIASES) return undefined
      passes = false
      return visit.BREAK
    },
    Map(_key, map) {
      const seen = new Set<unknown>()
      for (const pair of map.items) {
        if (!isScalar(pair.key) || Number.isNaN(pair.key.value)) continue
        if (seen.has(pair.key.value)) {
          passes = false
          return visit.BREAK
        }
        seen.add(pair.key.value)
      }
      return undefined
    },
  })
  return passes
}
