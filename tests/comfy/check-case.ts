// SPEC 14 1.41 CU-5a case 1, 1.45 B-1, 1.46: the check. It prints the server's version and,
// for each workflow that is not a draft (trial or proven), "complete" or the missing items. The names come from the app's
// own workflow file, never from the server's text. When the check does not end `ok`, it prints
// which call failed (its folder or class name, from the app's own file) and the failure's
// kind, reason and detail. [1.57] H-3: then one line per draft workflow, its model files
// present or missing (draft-files.ts). Everything goes through the printer, so the address
// never shows.
import type { ComfyClient } from '@/main/providers/comfyui/client'
import { checkServer } from '@/main/providers/comfyui/needs'
import { NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { ProviderFailure } from '@/main/providers/types'
import type { MissingItem } from '@/shared/schemas/queries/app'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { draftFileLines, keepFolderLists } from './draft-files'
import type { Print } from './print'
import type { FailedCall } from './recorder'

export const CHECKED_WORKFLOWS: readonly WorkflowSpec[] = NON_DRAFT_WORKFLOWS

function itemLine(item: MissingItem): string {
  if (item.what === 'version') return `  version: ${item.name} or later`
  if (item.what === 'model') return `  model file: ${item.folder ?? ''}/${item.name}`
  return `  node class: ${item.name}`
}

function failureLines(failed: FailedCall | undefined): string[] {
  if (!failed) return []
  const lines = [`The call that failed: ${failed.name}(${failed.arg ?? ''})`]
  const error = failed.error
  if (error instanceof ProviderFailure) {
    const { kind, reason, detail } = error.error
    lines.push(`kind: ${kind}, reason: ${reason ?? 'none'}, detail: ${detail}`)
  } else {
    lines.push(`error: ${error instanceof Error ? error.name : 'unknown'}`)
  }
  return lines
}

export async function runCheckCase(
  client: Pick<ComfyClient, 'systemStats' | 'modelFiles' | 'nodeInfo'>,
  failures: readonly FailedCall[],
  print: Print,
  workflows: readonly WorkflowSpec[] = CHECKED_WORKFLOWS,
): Promise<ComfyCheck> {
  const before = failures.length
  const kept = keepFolderLists(client)
  const result = await checkServer(kept.client, workflows)
  if (result.outcome !== 'ok') {
    print(`The check ended: ${result.outcome}`, ...failureLines(failures[before]))
    return result
  }
  print(`ComfyUI version: ${result.version ?? ''}`)
  if (result.note) print(`Note: ${result.note}`)
  for (const w of result.workflows) {
    if (w.missing.length === 0) print(`${w.id}: complete`)
    else print(`${w.id}: missing`, ...w.missing.map(itemLine))
  }
  // [1.57] H-3: the drafts' model files, from the lists just fetched.
  print(...draftFileLines(kept.lists))
  return result
}
