// The body of the publish job (spec/phases/phase-09.md "Publishing"; A-219, A-220, A-224,
// A-227, A-260). Security class full: it writes and deletes in the user's storage. Steps: (0)
// the work folder; (1) the campaign folder's file count (files without the replace
// confirmation end the job) and the old manifest, whose number + 1 is this publish's; (2) the
// export into the work folder with the publish header (progress to 0.5); (3) the components of
// the exported ads; (4) every path checked as a whole, then each file uploaded (to 0.95), each
// component checked again first, then manifest.json; (5) the old manifest's project read again,
// then the clean-up (to 1). After a failure or a cancel there is no manifest and no clean-up,
// so the old manifest stays. The work folder is removed in every case. Every failure ends with
// a fixed reason or detail: no storage error text, path or key reaches the job row.
import type { JobRunContext } from '@/main/jobs/types'
import type { ProjectHandle } from '@/main/db/project-file'
import { LocalFailure } from '@/main/jobs/local-failure'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'
import type { ManifestFile } from '@/shared/publish/manifest'
import { AppError } from '@/shared/schemas/result'
import { removeStale } from './clean-up'
import { componentUpload, type SkipProblem } from './component-upload'
import { collectComponents, type CollectedComponent } from './components'
import { fontConsent } from './font-consent'
import { consentCheck } from './inspect'
import { campaignPrefix, nextPublishNumber, readPrevious, writeManifest } from './manifest'
import { LocalFileRefused } from './open-inside'
import type { ExportForPublishResult } from './ports'
import { checkPublishPaths, exportUpload, remotePathOf } from './publish-files'
import type { PublishPlan } from './publish-plans'
import { uploadAll, type UploadFile } from './upload'
import { makeWorkFolder } from './work-folder'

export type PublishResult = {
  publishNumber: number
  uploaded: number
  removed: number
  skipped: Array<{ assetId: string; problem: SkipProblem }>
}

type Step = 'read' | 'upload' | 'manifest' | 'clean_up' | 'replace_not_confirmed' | 'folder_changed'
type Item = { file: UploadFile } | { component: CollectedComponent }

// The failures made here, already fixed: passed on as they are.
const ours = new WeakSet<ProviderFailure>()

function failure(error: ProviderFailure['error']): ProviderFailure {
  const made = new ProviderFailure(error)
  ours.add(made)
  return made
}

const stepFailure = (step: Step, kind: ProviderFailure['error']['kind'] = 'other') =>
  failure({ kind, detail: `publish_${step}_failed` })

// The fixed failure for anything a step throws. Only the error kind and the one reason a user
// acts on (dropbox_signed_out) are kept of a storage failure.
function fixed(step: Step, e: unknown): unknown {
  if (e instanceof ProviderCancelled || e instanceof LocalFailure || e instanceof AppError) return e
  if (e instanceof LocalFileRefused)
    return failure({ kind: 'other', detail: 'publish_file_refused' })
  if (!(e instanceof ProviderFailure)) {
    const path = e instanceof Error && e.message === 'Storage path refused'
    return path ? failure({ kind: 'other', detail: 'publish_path_refused' }) : stepFailure(step)
  }
  if (ours.has(e) || e.error.reason === 'publish_paths_clash') return e
  if (e.error.reason !== 'dropbox_signed_out') return stepFailure(step, e.error.kind)
  return failure({
    kind: e.error.kind,
    reason: 'dropbox_signed_out',
    detail: `publish_${step}_failed`,
  })
}

async function step<T>(name: Step, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw fixed(name, e)
  }
}

function stopIfCancelled(jc: JobRunContext): void {
  if (jc.cancelled() || jc.signal.aborted) throw new ProviderCancelled()
}

async function exported(
  jc: JobRunContext,
  plan: PublishPlan,
  work: string,
  header: { publishedAt: string; publishNumber: number },
): Promise<ExportForPublishResult> {
  try {
    return await jc.deps.publish.exportForPublish(jc.deps, {
      projectId: plan.projectId,
      campaignId: plan.campaignId,
      outputRoot: work,
      proceedDespiteWarnings: plan.proceedDespiteWarnings,
      proceedReason: plan.proceedReason,
      publishHeader: header,
      signal: jc.signal,
      onProgress: (f) => jc.progress(Math.min(Math.max(f, 0), 1) * 0.5),
    })
  } catch (e) {
    if (e instanceof ProviderCancelled || e instanceof LocalFailure) throw e
    if (jc.signal.aborted) throw new ProviderCancelled()
    throw new LocalFailure('export_failed')
  }
}

async function publishIn(
  jc: JobRunContext,
  plan: PublishPlan,
  project: ProjectHandle,
  work: string,
): Promise<PublishResult> {
  const { deps } = jc
  const { campaignId } = plan
  const storage = deps.publish.storageFor(deps, plan.storage)
  const prefix = campaignPrefix(campaignId)
  const before = await step('read', async () => {
    const files = (await storage.list(prefix)).filter((p) => p.startsWith(prefix)).length
    return { files, previous: await readPrevious(storage, campaignId, { log: deps.log }) }
  })
  if (before.files > 0 && !plan.replaceConfirmed) throw stepFailure('replace_not_confirmed')
  const header = {
    publishedAt: deps.now().toISOString(),
    publishNumber: nextPublishNumber(before.previous),
  }
  stopIfCancelled(jc)
  const result = await exported(jc, plan, work, header)
  stopIfCancelled(jc)
  const consented = consentCheck(deps, plan.projectId)
  const components = await collectComponents(
    project,
    { campaignId, variantIds: result.variantIds },
    { consented },
  )
  const items: Item[] = [
    ...result.files.map((f) => ({ file: exportUpload(work, f) })),
    ...components.map((c) => ({ component: c })),
  ]
  await step('upload', async () => {
    const remote = components.flatMap((c) => (c.remotePath === null ? [] : [c.remotePath]))
    checkPublishPaths(campaignId, [...result.files.map(remotePathOf), ...remote])
  })
  const list = fontConsent(deps)
  const fontConsented = (assetId: string, sha256: string) =>
    list.hasConsent(plan.projectId, assetId, sha256)
  const entries: ManifestFile[] = []
  const skipped: PublishResult['skipped'] = []
  for (const [index, item] of items.entries()) {
    stopIfCancelled(jc)
    let file: UploadFile
    if ('file' in item) file = item.file
    else {
      const checked = await step('upload', () =>
        componentUpload(project, item.component, fontConsented),
      )
      if ('problem' in checked) {
        skipped.push({ assetId: item.component.assetId, problem: checked.problem })
        continue
      }
      file = checked.file
    }
    entries.push(
      ...(await step('upload', () =>
        uploadAll(storage, campaignId, [file], { signal: jc.signal }),
      )),
    )
    jc.progress(0.5 + (0.45 * (index + 1)) / items.length)
  }
  stopIfCancelled(jc)
  // Read again: a publish of another project since the start leaves its files alone.
  const again = await step('read', () => readPrevious(storage, campaignId, { log: deps.log }))
  if ((again?.projectId ?? null) !== (before.previous?.projectId ?? null))
    throw stepFailure('folder_changed')
  const manifest = {
    format: 1 as const,
    appVersion: deps.appVersion,
    projectId: plan.projectId,
    campaignId,
    ...header,
    files: entries,
  }
  stopIfCancelled(jc)
  await step('manifest', () => writeManifest(storage, campaignId, manifest))
  const removed = await step('clean_up', () =>
    removeStale(
      storage,
      campaignId,
      entries.map((e) => e.path),
    ),
  )
  jc.progress(1)
  return { publishNumber: header.publishNumber, uploaded: entries.length, removed, skipped }
}

export async function runPublish(
  jc: JobRunContext,
  jobId: string,
  plan: PublishPlan,
  project: ProjectHandle,
): Promise<PublishResult> {
  const work = await makeWorkFolder(jc.deps.userDataDir, jobId)
  try {
    return await publishIn(jc, plan, project, work.path)
  } catch (e) {
    throw fixed('upload', e)
  } finally {
    await work.remove()
  }
}
