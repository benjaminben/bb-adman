// P10-5: what the AI tools need in the run-tools project, beside the slice H seed. Variant
// v-ai of direction d1 holds a visible call-to-action text layer (for propose_layout and
// copy_options) and a picture layer whose source is an imported picture (for cut_out). Kept
// out of v1, so the other tools' tests over v1 see the layers they always saw. Not a test file.
import { greyPng } from '@/main/providers/fake/png'
import type { ComfyFixture } from '../generation/comfy-fixture'

export const AI_VARIANT = 'v-ai'
export const AI_TEXT = 'l-ai-cta'
export const AI_PICTURE = 'l-ai-picture'

const COLUMNS = `id, variant_id, key, type, slot, name, z, copy, style, geometry, source, timing,
  animation, revs, synced_revs`

export async function seedAiTargets(f: ComfyFixture): Promise<void> {
  const assetId = await f.importPicture('AI Pictures', 'ai-seed-picture.png', greyPng(8, 8))
  const source = JSON.stringify({ assetId })
  f.db.exec(`
    INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
      duration_ms, created_by, created_at)
      VALUES ('${AI_VARIANT}', 'd1', 'AI', 1080, 1920, '9:16', 'en', 'image', 0, 'user', 'x');
    INSERT INTO layer (${COLUMNS})
      SELECT '${AI_TEXT}', '${AI_VARIANT}', 'cta', 'text', 'call_to_action', 'CTA', 1, 'Shop now',
      style, geometry, NULL, timing, animation, revs, synced_revs FROM layer WHERE id = 'l-text';
  `)
  f.db
    .prepare(
      `INSERT INTO layer (${COLUMNS})
       SELECT ?, ?, 'picture', 'image', NULL, 'Picture', 0, NULL, style, geometry, ?, timing,
       animation, revs, synced_revs FROM layer WHERE id = 'l-bg'`,
    )
    .run(AI_PICTURE, AI_VARIANT, source)
}
