// asset.addGenerated (SPEC 4.2 notes [1.8]; FR-063, FR-068, FR-216). A system command sent
// only by the job runner, after it wrote each file with AssetService.writeManaged. No window
// may send it (internal) and agents are denied it. Not undoable. The input holds asset IDs
// and extensions only: prepare reads each file at its managed path, run inserts the rows.
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { asset } from '../../db/schema'
import { readWireRow } from '../../db/rows'
import { assetsDirOf } from '../../assets/service'
import { inspectFile, type InspectedFile } from '../../assets/inspect'
import { isManagedName, managedPath, relativeToProject } from '../../assets/path-resolver'
import {
  assetAddGeneratedInput,
  type AssetAddGeneratedInput,
} from '../../../shared/schemas/commands/asset'
import type { JobRow } from '../../../shared/schemas/rows/job'
import { AppError } from '../../../shared/schemas/result'

type Prepared = Array<{ assetId: string; file: InspectedFile }>

// The prompt the job sent, from its request (SPEC 4.2: "the prompt from the job row").
function promptOf(request: unknown): string | null {
  if (typeof request !== 'object' || request === null) return null
  const prompt = (request as { prompt?: unknown }).prompt
  return typeof prompt === 'string' ? prompt : null
}

type RowContext = { job: JobRow; model: string | null; projectFile: string; createdAt: string }

function rowOf(item: Prepared[number], { job, model, projectFile, createdAt }: RowContext) {
  const { assetId, file } = item
  return {
    id: assetId,
    library: 'asset',
    kind: file.type.kind,
    origin: 'generated',
    storage: 'managed',
    subjectId: null,
    displayName: file.fileName,
    absPath: file.file,
    relPath: relativeToProject(projectFile, file.file),
    mime: file.type.mime,
    byteSize: file.byteSize,
    mtimeMs: file.mtimeMs,
    contentHash: file.contentHash,
    width: file.width,
    height: file.height,
    genRunId: job.id,
    genProvider: job.provider,
    genModel: model ?? job.model,
    genPrompt: promptOf(job.request),
    createdAt,
  }
}

async function prepareFiles(
  project: Parameters<typeof assetsDirOf>[0],
  input: AssetAddGeneratedInput,
): Promise<Prepared> {
  for (const f of input.files) {
    if (!isManagedName(f.assetId, f.ext)) {
      throw new AppError('INVALID_INPUT', 'A generated file has a name the app cannot use.')
    }
  }
  const dir = assetsDirOf(project)
  const prepared: Prepared = []
  for (const f of input.files) {
    const file = await inspectFile(managedPath(dir, f.assetId, f.ext))
    prepared.push({ assetId: f.assetId, file })
  }
  return prepared
}

export function assetAddGenerated(deps: Pick<CoreDeps, 'now'>) {
  return defineCommand({
    name: 'asset.addGenerated',
    internal: true,
    input: assetAddGeneratedInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) => prepareFiles(ctx.project, input),
    run(ctx, input, prepared) {
      const job = readWireRow(ctx.project.db, 'job', { id: input.jobId }) as JobRow | null
      if (!job) throw new AppError('NOT_FOUND', 'That job was not found.')
      const row: RowContext = {
        job,
        model: input.model ?? null,
        projectFile: ctx.project.filePath,
        createdAt: deps.now().toISOString(),
      }
      for (const item of prepared) {
        ctx.project.orm.insert(asset).values(rowOf(item, row)).run()
        ctx.changes.touch('asset', { id: item.assetId })
      }
      const assetIds = prepared.map((p) => p.assetId)
      return { data: { assetIds }, log: { campaignId: job.campaignId ?? undefined } }
    },
  })
}
