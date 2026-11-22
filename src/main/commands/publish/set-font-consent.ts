// publish.setFontConsent (spec/phases/phase-09.md "Font sharing consent is local", A-260,
// security class full). User only: agent policy deny. It writes this machine's consent list,
// never the project. The row must be a font of the project's asset library; to give consent its
// file must pass the component check, and the key takes the hash of the bytes measured now,
// never the hash the project file stores. A changed file therefore needs a new consent.
// Taking consent back removes every key of the font and needs no file. When the window sends the
// hash publish.inspect showed (`sha256`), a font whose bytes differ now is refused (P9-12).
import { defineCommand, type HandlerResult, type PrepareContext } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { hashFile } from '@/main/assets/inspect'
import { readWireRow } from '@/main/db/rows'
import { checkComponentFile } from '@/main/publish/component-file'
import { fontConsent } from '@/main/publish/font-consent'
import { isUlid } from '@/shared/publish/paths'
import {
  publishSetFontConsentInput,
  type PublishSetFontConsentInput,
  type PublishSetFontConsentReply,
} from '@/shared/schemas/commands/publish'
import { AppError } from '@/shared/schemas/result'
import type { AssetRow } from '@/shared/schemas/rows/asset'

type Deps = Pick<CoreDeps, 'userDataDir' | 'log'>

const notAFont = () => new AppError('NOT_FOUND', 'That font is not in this project.')
const fontUnusable = () =>
  new AppError('RULE_VIOLATION', 'The font file cannot be found or is not a usable font.', {
    reason: 'font_file_unusable',
  })

function fontRow(ctx: PrepareContext, assetId: string): AssetRow {
  if (!isUlid(assetId)) throw notAFont()
  let row: AssetRow | null
  try {
    row = readWireRow(ctx.project.db, 'asset', { id: assetId }) as AssetRow | null
  } catch {
    row = null
  }
  if (row === null || row.library !== 'asset' || row.kind !== 'font') throw notAFont()
  return row
}

// The hash of the checked file when consent is given; null when it is taken back.
async function measure(ctx: PrepareContext, input: PublishSetFontConsentInput) {
  const row = fontRow(ctx, input.assetId)
  if (!input.allowed) return null
  const checked = await checkComponentFile(ctx.project, row)
  if ('problem' in checked) throw fontUnusable()
  const sha256 = await hashFile(checked.absPath)
  if (input.sha256 !== undefined && input.sha256 !== sha256) throw fontUnusable()
  return sha256
}

export function publishSetFontConsent(deps: Deps) {
  return defineCommand({
    name: 'publish.setFontConsent',
    input: publishSetFontConsentInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) => measure(ctx, input),
    run(ctx, input, sha256: string | null): HandlerResult<PublishSetFontConsentReply> {
      const list = fontConsent(deps)
      const projectId = ctx.project.projectId
      if (sha256 === null) list.removeConsent(projectId, input.assetId)
      else list.setConsent(projectId, input.assetId, sha256)
      return { data: {} }
    },
  })
}
