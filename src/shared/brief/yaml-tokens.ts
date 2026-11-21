// SPEC 6.1 item 9 rule 1 [1.31], security class: a check on the library's own tokens,
// before compose. A directive other than %YAML (its first word found the library's way:
// trim, then split on spaces and tabs) and a document nested deeper than MAX_BRIEF_DEPTH
// both fail. CST.visit calls its visitor on entry, so the walk stops before going deeper.
import { CST, Parser } from 'yaml'
import { MAX_BRIEF_DEPTH } from '@/shared/config/brief-limits'

function tooDeep(token: CST.Document): boolean {
  let deep = false
  CST.visit(token, (_item, path) => {
    if (path.length <= MAX_BRIEF_DEPTH) return undefined
    deep = true
    return CST.visit.BREAK
  })
  return deep
}

export function passesYamlTokens(text: string): boolean {
  for (const token of new Parser().parse(text)) {
    if (token.type === 'directive' && token.source.trim().split(/[ \t]+/)[0] !== '%YAML') {
      return false
    }
    if (token.type === 'document' && tooDeep(token)) return false
  }
  return true
}
