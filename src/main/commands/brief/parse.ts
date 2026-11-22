// brief.parse (SPEC 4.2, 6.1; FR-020, FR-022). Writes nothing: the file is read in
// prepare and the draft is returned from run (SPEC 3.6). A brief has no size limit
// (SPEC 14 1.39 Z7), so the whole file is read. Nothing of the brief reaches the log.
// The pictures a brief names are checked in prepare too (Round 2 plan D3): any path, or the
// asset ID of an image in this project. Only a person may call it (agent policy deny).
import fs from 'node:fs/promises'
import path from 'node:path'
import type Database from 'better-sqlite3'
import { checkBriefPictures } from '@/main/assets/brief-pictures'
import { defineCommand } from '@/main/commands/types'
import { parseBriefFile } from '@/shared/brief/parse'
import { parseBriefText } from '@/shared/brief/text'
import { primaryLanguageOf } from '@/shared/brief/primary-language'
import { briefParseInput, type BriefParsed } from '@/shared/schemas/commands/brief'
import type { BriefDraft } from '@/shared/schemas/brief'
import { AppError, type ErrorBody, type Result } from '@/shared/schemas/result'
import type { BriefSyntax } from '@/shared/templates/types'

// The bus logs an error's message. The reply names the bad line's text; the log line gets
// the message without it, so the reason and the line number are logged and no word of the
// file is (SPEC 14 1.39, "The YAML message").
class BriefError extends AppError {
  private readonly body: ErrorBody

  constructor(body: ErrorBody) {
    const line = body.details?.line
    super(
      body.code,
      typeof line === 'number'
        ? `The brief is malformed. The first line that could not be read is line ${line}.`
        : body.message,
      body.details,
    )
    this.body = body
  }

  override toBody(): ErrorBody {
    return this.body
  }
}

const SYNTAX_BY_ENDING: Record<string, BriefSyntax> = {
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
}

function typeNotSupported(): AppError {
  return new AppError(
    'RULE_VIOLATION',
    'This kind of brief file cannot be read yet. Use a JSON or YAML file.',
    { reason: 'brief_type_not_supported' },
  )
}

async function readBrief(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new AppError('NOT_FOUND', 'That file was not found.')
    }
    throw new AppError('RULE_VIOLATION', 'That file could not be read.', {
      reason: 'file_not_readable',
    })
  }
}

function draftOf(result: Result<BriefDraft>): BriefDraft {
  if (!result.ok) throw new BriefError(result.error)
  return result.data
}

// D3 rule 1: an asset ID is used only when it names an image of the open project.
function imageLookup(db: Database.Database): (assetId: string) => boolean {
  const row = db.prepare("SELECT 1 FROM asset WHERE id = ? AND kind = 'image'")
  return (assetId) => row.get(assetId) !== undefined
}

async function answer(
  db: Database.Database,
  briefPath: string | null,
  draft: BriefDraft,
): Promise<BriefParsed> {
  const isImage = imageLookup(db)
  return {
    draft,
    primaryLanguage: primaryLanguageOf(draft),
    subjectPictures: await checkBriefPictures(briefPath, draft.subjects, { isImage }),
  }
}

export function briefParse() {
  return defineCommand({
    name: 'brief.parse',
    input: briefParseInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<BriefParsed> {
      if (input.filePath === undefined) {
        const read = parseBriefText(input.text ?? '')
        const draft = draftOf(read.ok ? { ok: true, data: read.data.draft } : read)
        return answer(ctx.project.db, null, draft)
      }
      // F-2: a relative path would be read against the app's own folder.
      if (!path.isAbsolute(input.filePath)) {
        throw new AppError('INVALID_INPUT', 'The file path must be absolute.')
      }
      const syntax = SYNTAX_BY_ENDING[path.extname(input.filePath).toLowerCase()]
      if (!syntax) throw typeNotSupported()
      const draft = draftOf(parseBriefFile(await readBrief(input.filePath), syntax))
      return answer(ctx.project.db, input.filePath, draft)
    },
    run(_ctx, _input, prepared) {
      return { data: prepared }
    },
  })
}
