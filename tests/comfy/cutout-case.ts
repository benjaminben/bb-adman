// P4-9 (spec/ai-jobs.md "Cut-out", D-092, A-57): test:comfy case 8, the cut-out on
// birefnet-cutout, only with ADMAN_COMFY_CUTOUT=1 set in the terminal. It runs at client level
// as cases 5 to 7 do, so the recorder sees every call and the 30-minute limit with its
// own-run cancel holds; the graph is the one the adapter sends (fillWorkflow of the shipped
// spec with the uploaded name). The picture is the test-made one, its bytes alone sent under
// uploadName. Passes on a PNG of colour type 6; prints time, pixel and byte size, and how
// many pixels are see-through; writes the result to the temporary folder.
import { checkServer } from '@/main/providers/comfyui/needs'
import { birefnetCutout } from '@/main/providers/comfyui/workflows/birefnet'
import { MAX_PICTURE_BYTES } from '@/main/providers/picture-limits'
import type { MissingItem } from '@/shared/schemas/queries/app'
import {
  checkPicture,
  runAndReport,
  sendPicture,
  type CaseKit,
  type CaseOutcome,
} from './case-steps'
import type { SentPicture } from './given-picture'
import { countAlpha, pngColourType } from './png-alpha'
import { makeTestPicture, TEST_PICTURE_SIDE } from './test-picture'

// The spec names the test's own picture for this case, so ADMAN_COMFY_PICTURE is not read.
function testMade(): SentPicture {
  const side = TEST_PICTURE_SIDE
  return {
    kind: 'test-made',
    bytes: makeTestPicture(),
    type: 'image/png',
    width: side,
    height: side,
  }
}

function itemLine(item: MissingItem): string {
  if (item.what === 'version') return `  version: ${item.name} or later`
  if (item.what === 'model') return `  model file: ${item.folder ?? ''}/${item.name}`
  return `  node class: ${item.name}`
}

// A cut-out passes when it is a PNG whose header says red, green, blue and alpha.
const checkCutout = (kit: CaseKit) => (bytes: Uint8Array) => {
  const ext = checkPicture(kit)(bytes)
  const type = pngColourType(bytes)
  if (type !== 6) throw new Error(`The result has no alpha channel (PNG colour type ${type})`)
  kit.print('PNG colour type: 6 (red, green, blue, alpha)')
  const count = countAlpha(bytes)
  kit.print(
    count
      ? `See-through pixels: ${count.clear} of ${count.pixels}, partly see-through: ${count.partly}`
      : 'See-through pixels: not counted (a PNG form this test does not read)',
  )
  return ext
}

export async function cutoutCase(kit: CaseKit): Promise<CaseOutcome> {
  if (kit.env.ADMAN_COMFY_CUTOUT !== '1') {
    return { skip: 'ADMAN_COMFY_CUTOUT is not 1, so the cut-out case does not run.' }
  }
  const spec = birefnetCutout
  const result = await checkServer(kit.client, [spec])
  if (result.outcome !== 'ok') throw new Error(`The check ended: ${result.outcome}`)
  const missing = result.workflows[0]?.missing ?? []
  if (missing.length > 0) {
    kit.print(`${spec.id}: missing`, ...missing.map(itemLine))
    return { skip: `${spec.id}: ${missing.length} items missing, so it does not run.` }
  }
  kit.print(`${spec.id}: complete`)
  const name = await sendPicture(kit, testMade())
  const values = { references: [name] }
  await runAndReport(kit, spec, result.version, values, MAX_PICTURE_BYTES, checkCutout(kit))
  return { done: true }
}
