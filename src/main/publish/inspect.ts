// The body of publish.inspect (spec/phases/phase-09.md "Publishing"; A-218, A-220, A-260).
// The query file refuses the agent before this is reached. The reply holds the storages and
// their readiness, what is already published under {campaignId}/ in the chosen storage, and
// the campaign's components with their full local paths. No key, token or signed address is
// ever part of it: a storage failure is one fixed sentence and the kind's own, its detail kept
// out of the reply and the log.
import type { CoreDeps } from '@/main/core-deps'
import { hashFile } from '@/main/assets/inspect'
import type { ProjectHandle } from '@/main/db/project-file'
import { plainMessage } from '@/main/providers/messages'
import { ProviderFailure } from '@/main/providers/types'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { PUBLISHED_FOLDER_UNREADABLE, publishRefusal } from '@/shared/publish/messages'
import { isCampaignIdForm } from '@/shared/publish/paths'
import type {
  PublishComponent,
  PublishInspect,
  PublishInspectInput,
} from '@/shared/schemas/queries/publish'
import { AppError } from '@/shared/schemas/result'
import { collectComponents } from './components'
import { fontConsent } from './font-consent'
import { campaignPrefix, readPrevious } from './manifest'
import { publishStorages } from './readiness'

type Storage = PublishInspect['storages'][number]

function folderUnreadable(deps: CoreDeps, storage: Storage, error: unknown): AppError {
  const kind = error instanceof ProviderFailure ? error.error.kind : 'other'
  // The kind only: a provider's detail may name a key or an address.
  deps.log.write({
    level: 'warn',
    event: 'query',
    name: 'publish.inspect',
    actor: 'user',
    ok: false,
    errorKind: kind,
    message: 'The published folder could not be read.',
    context: { provider: storage.id },
  })
  const message = `${PUBLISHED_FOLDER_UNREADABLE} ${plainMessage(kind, storage.label)}`
  return new AppError('PROVIDER_ERROR', message, { provider: storage.id, kind })
}

async function existingOf(
  deps: CoreDeps,
  input: PublishInspectInput,
  storages: Storage[],
): Promise<PublishInspect['existing']> {
  if (input.storage === null) return null
  const listed = storages.find((s) => s.id === input.storage)
  if (listed === undefined) {
    throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.', {
      provider: input.storage,
      job: 'storage',
    })
  }
  if (listed.ready !== 'ready') return null
  if (!isCampaignIdForm(input.campaignId)) throw publishRefusal('campaign_id_unsafe')
  try {
    const storage = deps.publish.storageFor(deps, listed.id)
    const prefix = campaignPrefix(input.campaignId)
    const files = (await storage.list(prefix)).filter((p) => p.startsWith(prefix)).length
    const previous = await readPrevious(storage, input.campaignId, { log: deps.log })
    return {
      files,
      publishNumber: previous?.publishNumber ?? null,
      publishedAt: previous?.publishedAt ?? null,
      otherProject: previous !== null && previous.projectId !== input.projectId,
    }
  } catch (error) {
    throw folderUnreadable(deps, listed, error)
  }
}

function campaignVariantIds(project: ProjectHandle, campaignId: string): string[] {
  const rows = project.db
    .prepare(
      `SELECT v.id FROM variant v JOIN direction d ON d.id = v.direction_id
       WHERE d.campaign_id = ? ORDER BY v.id`,
    )
    .all(campaignId) as Array<{ id: string }>
  return rows.map((r) => r.id)
}

// A font is `confirmed` only when the local list holds the key for the hash of its bytes now;
// the project file's flag gives at most `needs_confirming` (A-260). The publish job follows the
// same rule (collectComponents).
export function consentCheck(deps: Pick<CoreDeps, 'userDataDir' | 'log'>, projectId: string) {
  const list = fontConsent(deps)
  return async (assetId: string, file: string): Promise<boolean> =>
    list.hasConsent(projectId, assetId, await hashFile(file))
}

async function componentsOf(
  deps: CoreDeps,
  project: ProjectHandle,
  campaignId: string,
): Promise<PublishComponent[]> {
  const variantIds = campaignVariantIds(project, campaignId)
  const consented = consentCheck(deps, project.projectId)
  const collected = await collectComponents(project, { campaignId, variantIds }, { consented })
  return collected.map((c) => ({
    assetId: c.assetId,
    displayName: c.displayName,
    kind: c.kind,
    folder: c.folder,
    localPath: c.localPath,
    problem: c.problem,
    share: c.share,
  }))
}

export async function inspectPublish(
  deps: CoreDeps,
  project: ProjectHandle,
  input: PublishInspectInput,
): Promise<PublishInspect> {
  requireCampaign(project.db, input.campaignId)
  const storages = publishStorages(deps)
  const existing = await existingOf(deps, input, storages)
  const components = await componentsOf(deps, project, input.campaignId)
  return { storages, existing, components }
}
