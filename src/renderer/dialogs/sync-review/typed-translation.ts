// Typing a translation by hand in the sync review (spec/data-rules.md, "Sync"; P6-16): the
// variant's layer with the change's key, read with variant.get, then translation.set through
// the app store's command. Gives the refusal's message, or null when the text was saved.
import type { AdmanApi } from '@/shared/schemas/api'
import type { Result } from '@/shared/schemas/result'
import type { VariantGet } from '@/shared/schemas/queries/variant'

type Command = (name: string, input: unknown) => Promise<Result<unknown>>
type Typed = { projectId: string; variantId: string; layerKey: string; text: string }

export async function typedTranslation(
  api: AdmanApi,
  command: Command,
  typed: Typed,
): Promise<string | null> {
  const { projectId, variantId, layerKey, text } = typed
  const read = await api.query('variant.get', { projectId, variantId })
  if (!read.ok) return read.error.message
  const layer = (read.data as VariantGet | null)?.layers.find((l) => l.key === layerKey)
  if (!layer) return 'That layer was not found.'
  const input = { projectId, layerId: layer.id, text, applyToSameLanguage: false }
  const result = await command('translation.set', input)
  return result.ok ? null : result.error.message
}
