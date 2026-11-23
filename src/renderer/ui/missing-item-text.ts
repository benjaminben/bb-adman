// S2-1: the text of one item a ComfyUI server lacks, for Settings and the run row.
// The name and folder come from the workflow's own file (a custom workflow's from its graph,
// shown only in the Settings check) and are drawn as text only.
import type { MissingItem } from '@/shared/schemas/queries/app'

const KINDS: Record<MissingItem['what'], string> = {
  model: 'Model',
  node: 'Node',
  version: 'ComfyUI version',
  add_on: 'Add-on',
}

export function missingItemText(item: MissingItem): string {
  const folder = item.folder === undefined ? '' : `, in the folder ${item.folder}`
  return `${KINDS[item.what]} ${item.name}${folder}`
}
