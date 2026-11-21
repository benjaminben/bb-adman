// approvals.endLink, "Turn off link" (spec/approvals.md "approvals.endLink"). Security class;
// agent policy deny. prepare makes the shared refusals (a live link needed, no bucket needed),
// reads the sign-offs a last time, deletes this campaign's link on the service and empties this
// campaign's picture folder; run ends the local link and forgets the password.
// Half-done states: a failed delete on the service fails the command with nothing changed
// here. A link deleted on the service whose local write then failed (rolled back, still live)
// is found gone on the next press, which ends it here without the service steps and keeps the
// sign-offs it already had. Forgetting the password runs after the commit and cannot undo it.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { approvalsCampaignInput } from '@/shared/schemas/commands/approvals'
import { pictureFolder } from '@/shared/approvals/picture-paths'
import { createApprovalsClient } from '@/main/approvals/client'
import { afterCommit } from '@/main/approvals/after-commit'
import {
  endLocalLink,
  linkIsLive,
  readLink,
  type SignoffRecord,
} from '@/main/approvals/local-store'
import { requireApprovalsReady } from '@/main/approvals/ready'
import { AppError } from '@/shared/schemas/result'
import { ProviderFailure } from '@/main/providers/types'

type Pair = { projectId: string; campaignId: string }

function kindOf(error: unknown): string {
  if (error instanceof ProviderFailure) return error.error.kind
  if (error instanceof AppError) return error.code
  return 'other'
}

// Step 3: every picture file of this campaign's folder, and nothing else. A failure is logged
// once, by kind, and does not fail the command.
async function emptyPictureFolder(deps: CoreDeps, pair: Pair): Promise<void> {
  try {
    const store = deps.approvals.pictures()
    const folder = pictureFolder(pair.projectId, pair.campaignId)
    await store.remove(await store.list(folder))
  } catch (error) {
    deps.log.write({
      level: 'warn',
      event: 'provider',
      name: 'approvals.pictures',
      actor: 'system',
      ok: false,
      projectId: pair.projectId,
      campaignId: pair.campaignId,
      errorKind: kindOf(error),
      message: 'The pictures of a turned-off link could not be removed.',
      context: { step: 'endLink' },
    })
  }
}

export function approvalsEndLink(deps: CoreDeps) {
  return defineCommand({
    name: 'approvals.endLink',
    input: approvalsCampaignInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<{ lastRead: SignoffRecord[] | null }> {
      const db = ctx.project.db
      const service = requireApprovalsReady(deps, db, input.campaignId, {
        bucket: false,
        link: 'live',
        linkIsLive: () => linkIsLive(db, input.campaignId, deps.log),
      })
      const client = createApprovalsClient(service, {
        allowLocalHttp: deps.devTools,
        log: deps.log,
      })
      const pair = { projectId: input.projectId, campaignId: input.campaignId }
      const state = await client.getLink(pair)
      // false: the link went between the read and the delete; it is gone either way.
      if (state !== null) await client.deleteLink(pair)
      await emptyPictureFolder(deps, pair)
      const lastRead =
        state?.signoffs.map(({ variantKey, ...s }) => ({ ...s, variantId: variantKey })) ?? null
      return { lastRead }
    },
    run(ctx, input, prepared): HandlerResult<Record<string, never>> {
      const { projectId, campaignId } = input
      const now = deps.now().toISOString()
      endLocalLink(ctx.project.db, campaignId, now, prepared.lastRead)
      const ids = { projectId, campaignId, command: 'approvals.endLink' }
      const ended = () => readLink(ctx.project.db, campaignId, deps.log)?.endedAt === now
      afterCommit(deps.log, ids, ended, () => deps.approvals.changed(projectId, campaignId))
      // Best effort, after the commit, so a password file that cannot be written never loses
      // the sign-offs just read. A kept password of an ended link is harmless; the next
      // createLink replaces it.
      afterCommit(deps.log, ids, ended, () =>
        deps.approvals.passwords.forget(projectId, campaignId),
      )
      return { data: {}, log: { campaignId: input.campaignId } }
    },
  })
}
