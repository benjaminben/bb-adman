// SPEC 6.1 "Reading a brief file safely" [1.23], security class. A brief may come from
// anyone, so it is read as hostile: a size limit before parsing, one parser chosen by
// `syntax`, YAML with the plain core rules only, and errors that hold none of the file.
// Pure; never throws.
import { parseDocument, type DocumentOptions, type ParseOptions, type SchemaOptions } from 'yaml'
import { fail, type ErrorBody } from '../schemas/result'
import type { ParseBrief } from '../templates/types'
import { MAX_BRIEF_ALIASES, MAX_BRIEF_BYTES } from '../config/brief-limits'
import { briefDraftFrom, BRIEF_UNREADABLE } from './draft'
import { passesYamlTokens } from './yaml-tokens'
import { passesYamlWalk } from './yaml-walk'

export const BRIEF_TOO_LARGE: ErrorBody = {
  code: 'INVALID_INPUT',
  message: 'The brief is too large. The limit is 64 KB.',
  details: { reason: 'brief_too_large' },
}

const BYTE_ORDER_MARK = '\uFEFF'

// SPEC 6.1 item 3, set here whatever the library's defaults are. resolveKnownTags: false
// keeps !!binary, !!set and !!timestamp from giving anything but plain data. logLevel
// 'error' prints nothing ('silent' would also drop the "several documents" error).
// Item 7 [1.26]: uniqueKeys is off because passesYamlWalk does that check in one pass;
// prettyErrors is off because the errors are never read.
const YAML_OPTIONS: ParseOptions & DocumentOptions & SchemaOptions = {
  version: '1.2',
  schema: 'core',
  customTags: [],
  resolveKnownTags: false,
  merge: false,
  uniqueKeys: false,
  prettyErrors: false,
  logLevel: 'error',
}

function readYaml(text: string): unknown {
  if (!passesYamlTokens(text)) throw new Error('unreadable')
  const doc = parseDocument(text, YAML_OPTIONS)
  if (doc.errors.length > 0 || !passesYamlWalk(doc)) throw new Error('unreadable')
  return doc.toJS({ maxAliasCount: MAX_BRIEF_ALIASES })
}

// SPEC 6.1 item 7 [1.26]: a text never has fewer bytes than characters, so a text too long
// in characters needs no counting.
function tooLarge(text: string): boolean {
  return text.length > MAX_BRIEF_BYTES || new TextEncoder().encode(text).length > MAX_BRIEF_BYTES
}

export const parseBrief: ParseBrief = (text, syntax) => {
  if (tooLarge(text)) return fail(BRIEF_TOO_LARGE)
  try {
    const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text
    return briefDraftFrom(syntax === 'json' ? JSON.parse(body) : readYaml(body))
  } catch {
    return fail(BRIEF_UNREADABLE)
  }
}
