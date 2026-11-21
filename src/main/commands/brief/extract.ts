// brief.extract (spec/ai-jobs.md "Brief reading"; FR-022, FR-171). Security class: it reads a
// path the caller names, so it keeps brief.parse's path rules (absolute, read whole as UTF-8,
// its NOT_FOUND and file_not_readable errors, no size limit, D-059 item 2) and agents are denied
// it by the policy table. The checks run in order: the path, its ending, the provider, the key,
// then the read. The text goes into the job's request only, so a retry needs no file; no error
// message, log id or reply holds a word of it.
import fs from 'node:fs/promises'
import path from 'node:path'
import { defineCommand, type ProjectContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { briefFileKind } from '@/shared/brief/brief-file-kind'
import { briefExtractInput, type BriefExtractInput } from '@/shared/schemas/commands/brief'
import type { BriefJobRequest } from '@/shared/schemas/jobs/brief-extraction'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

type Deps = Pick<CoreDeps, 'jobs' | 'providers' | 'secrets'>

function textProvider(deps: Deps, id: string): ProviderInfo {
  const info = deps.providers.find((p) => p.id === id)
  if (!info?.available || !info.jobs.includes('text')) {
    throw new AppError('INVALID_INPUT', 'That provider cannot read briefs.', { provider: id })
  }
  return info
}

function checkPath(filePath: string): void {
  // F-2: a relative path would be read against the app's own folder.
  if (!path.isAbsolute(filePath)) {
    throw new AppError('INVALID_INPUT', 'The file path must be absolute.')
  }
  if (briefFileKind(filePath) !== 'text') {
    throw new AppError('RULE_VIOLATION', 'Choose a Markdown or plain-text brief to read with AI.', {
      reason: 'brief_type_not_supported',
    })
  }
}

// The errors of brief.parse. A folder or any other file that cannot be read is file_not_readable.
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

function enqueue(deps: Deps, ctx: ProjectContext, input: BriefExtractInput, text: string) {
  const provider = textProvider(deps, input.provider)
  const request: BriefJobRequest = { text }
  // Its paid call counts in no campaign: the campaign does not exist yet.
  return deps.jobs.enqueue(ctx, {
    kind: 'brief_extraction',
    campaignId: null,
    variantId: null,
    layerId: null,
    slot: null,
    provider: provider.id,
    model: provider.defaultModels.text ?? '',
    request,
    startedBy: ctx.actor === 'agent' ? 'agent' : 'user',
  })
}

export function briefExtract(deps: Deps) {
  return defineCommand({
    name: 'brief.extract',
    input: briefExtractInput,
    projectId: (input) => input.projectId,
    async prepare(_ctx, input): Promise<string> {
      checkPath(input.filePath)
      const provider = textProvider(deps, input.provider)
      requireProviderKeys(deps, provider.id, 'read a brief with AI')
      const text = await readBrief(input.filePath)
      if (text.trim() === '') throw new AppError('INVALID_INPUT', 'The brief file is empty.')
      return text
    },
    run(ctx, input, text) {
      return { data: { jobId: enqueue(deps, ctx, input, text) } }
    },
  })
}
