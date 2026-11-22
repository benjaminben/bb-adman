// DLG-4b (choice C-15): the fan-out dialog's cost lines. Whether a provider is paid is decided
// once, by the run dialog's `runCost` (not local and not the fake provider; an unknown one is
// paid), so a paid line is never worded as free. A paid line is a MoneyLine, "Paid: {n} fills →
// {Provider} · {model}" or "Paid: up to {n} translations → {Provider} · {model}" (R3-2); a free one keeps a plain line
// saying nothing is charged. Null when nothing of that kind is sent.
import { runCost, type RunCost } from '@/renderer/dialogs/run-dialog/run-summary'
import { plural } from '@/renderer/ui/plural'
import { serviceWords } from '@/shared/providers/model-words'
import type { ProviderInfo } from '@/shared/schemas/queries/app'

type Provider = Pick<ProviderInfo, 'id' | 'label' | 'local'> &
  Partial<Pick<ProviderInfo, 'modelLabels'>>

const FREE = 'Nothing is charged.'

const paidFor = (provider: Provider) => runCost({ job: 'image', provider }).paid

// R3-2: `comfyModel` is the model of the ComfyUI workflow a fill would get.
export function fillCost(
  n: number,
  provider: Provider,
  comfyModel?: string | null,
): RunCost | null {
  if (n === 0) return null
  const fills = plural(n, 'fill')
  const name = serviceWords(provider, 'image', comfyModel)
  if (paidFor(provider)) return { paid: true, words: `Paid: ${fills} → ${name}` }
  return { paid: false, words: `${fills} on ${name}. ${FREE}` }
}

// P6-15: up to one paid request per new language, with the Settings text provider.
export function translationCost(n: number, provider: Provider | null): RunCost | null {
  if (n === 0) return null
  if (!provider) {
    const words =
      'No provider can translate yet. The new texts stay marked as missing a translation.'
    return { paid: false, words }
  }
  const name = serviceWords(provider, 'text')
  if (paidFor(provider)) {
    return { paid: true, words: `Paid: up to ${plural(n, 'translation')} → ${name}` }
  }
  const what = `Translating ${plural(n, 'language')}`
  if (provider.id === 'fake')
    return { paid: false, words: `${what} uses the fake provider. ${FREE}` }
  return { paid: false, words: `${what} runs on ${name}. ${FREE}` }
}

export function translationLine(n: number, provider: Provider | null): string | null {
  return translationCost(n, provider)?.words ?? null
}
