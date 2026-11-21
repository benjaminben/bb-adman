// translation.exportSheet (spec/phases/phase-06.md, design addition 4; A-164). Writes the
// translation sheet to a path from outside. Agent policy deny. Not undoable, and writes nothing
// to the project, so all its work is the prepare step. The reply names the file, not the path.
import path from 'node:path'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { translationRows } from '@/main/translation/rows'
import { checkSheetPath, writeSheet } from '@/main/translation/sheet-path'
import { sheetCsv } from '@/shared/translation/sheet'
import {
  translationExportSheetInput,
  type TranslationExportSheetReply,
} from '@/shared/schemas/commands/translation'

export function translationExportSheet(_deps: CoreDeps) {
  return defineCommand({
    name: 'translation.exportSheet',
    input: translationExportSheetInput,
    projectId: (input) => input.projectId,
    async prepare(ctx, input): Promise<TranslationExportSheetReply> {
      const campaign = requireCampaign(ctx.project.db, input.campaignId)
      const target = await checkSheetPath(ctx.project, input.filePath)
      const rows = translationRows(ctx.project.db, campaign)
      await writeSheet(target, sheetCsv(rows))
      return { path: path.basename(target), rowCount: rows.length }
    },
    run: (_ctx, _input, prepared) => ({ data: prepared }),
  })
}
