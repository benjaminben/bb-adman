// SPEC 6.1 "Reading a brief file safely" [1.23], security class. A brief may come from
// anyone, so it is read as hostile: a size limit before parsing, one parser chosen by
// `syntax`, YAML with the plain core rules only, and errors that hold none of the file.
// Pure; never throws.
import { parseDocument, type DocumentOptions, type ParseOptions, type SchemaOptions } from 'yaml'
import { fail, type ErrorBody } from '../schemas/result'
import type { ParseBrief } from '../templates/types'
import { MAX_BRIEF_BYTES } from '../config/brief-limits'
import { briefDraftFrom, BRIEF_UNREADABLE } from './draft'

export const BRIEF_TOO_LARGE: ErrorBody = {
  code: 'INVALID_INPUT',
  message: 'The brief is too large. The limit is 1 MB.',
  details: { reason: 'brief_too_large' },
}

const BYTE_ORDER_MARK = '\uFEFF'

// SPEC 6.1 item 3, set here whatever the library's defaults are. resolveKnownTags: false
// keeps !!binary, !!set and !!timestamp from giving anything but plain data. logLevel
// 'error' prints nothing ('silent' would also drop the "several documents" error).
const YAML_OPTIONS: ParseOptions & DocumentOptions & SchemaOptions = {
  version: '1.2',
  schema: 'core',
  customTags: [],
  resolveKnownTags: false,
  merge: false,
  uniqueKeys: true,
  logLevel: 'error',
}

const MAX_ALIAS_COUNT = 100

function readYaml(text: string): unknown {
  const doc = parseDocument(text, YAML_OPTIONS)
  if (doc.errors.length > 0) throw new Error('unreadable')
  return doc.toJS({ maxAliasCount: MAX_ALIAS_COUNT })
}

export const parseBrief: ParseBrief = (text, syntax) => {
  if (text.length > MAX_BRIEF_BYTES) return fail(BRIEF_TOO_LARGE)
  try {
    const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text
    return briefDraftFrom(syntax === 'json' ? JSON.parse(body) : readYaml(body))
  } catch {
    return fail(BRIEF_UNREADABLE)
  }
}
