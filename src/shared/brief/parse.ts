// SPEC 6.1 "Reading a brief file safely" [1.23], security class. A brief may come from
// anyone, so it is read as hostile: one parser chosen by `syntax`, YAML with the plain core
// rules only, and errors that hold none of the file but, for malformed YAML, its first bad
// line [1.39 Z3]. A brief has no size limit [1.39 Z7].
// Item 9 [1.31]: YAML is read as a plain subset. The library's tokens are checked before
// compose (passesYamlTokens), the composed document is walked before toJS (passesYamlWalk),
// and toJS reads no alias. Pure; never throws.
import { parseDocument, type DocumentOptions, type ParseOptions, type SchemaOptions } from 'yaml'
import { fail } from '@/shared/schemas/result'
import type { ParseBrief } from '@/shared/templates/types'
import { briefDraftFrom, BRIEF_UNREADABLE } from './draft'
import { badLineError } from './bad-line'
import { passesYamlTokens } from './yaml-tokens'
import { passesYamlWalk } from './yaml-walk'

const BYTE_ORDER_MARK = '﻿'

// SPEC 6.1 item 3, set here whatever the library's defaults are. resolveKnownTags: false
// keeps !!binary, !!set and !!timestamp from giving anything but plain data. logLevel
// 'error' prints nothing ('silent' would also drop the "several documents" error).
// Item 7 [1.26]: uniqueKeys is off because passesYamlWalk does that check in one pass;
// prettyErrors is off because only an error's start offset is read.
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

// SPEC 14 1.39 "The YAML message": carries the smallest start offset of the library's errors,
// or null when the app's own rules refused the file. An error's message is never read.
class YamlFault extends Error {
  constructor(readonly offset: number | null) {
    super('unreadable')
  }
}

function readYaml(text: string): unknown {
  if (!passesYamlTokens(text)) throw new YamlFault(null)
  const doc = parseDocument(text, YAML_OPTIONS)
  if (doc.errors.length > 0) throw new YamlFault(Math.min(...doc.errors.map((e) => e.pos[0])))
  if (!passesYamlWalk(doc)) throw new YamlFault(null)
  return doc.toJS({ maxAliasCount: 0 })
}

// SPEC 14 1.39 Z3: as parseBrief, but a malformed YAML brief's error names its first bad line.
export const parseBriefFile: ParseBrief = (text, syntax) => {
  const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text
  try {
    return briefDraftFrom(syntax === 'json' ? JSON.parse(body) : readYaml(body))
  } catch (error) {
    const offset = error instanceof YamlFault ? error.offset : null
    return fail(offset === null ? BRIEF_UNREADABLE : badLineError(body, offset))
  }
}

export const parseBrief: ParseBrief = (text, syntax) => {
  const result = parseBriefFile(text, syntax)
  const unreadable = !result.ok && result.error.details?.reason === 'brief_unreadable'
  return unreadable ? fail(BRIEF_UNREADABLE) : result
}
