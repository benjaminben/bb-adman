// The fake provider's text part (spec/ai-jobs.md "The fake provider's parts"): reads a brief
// from `Label: value` lines, gives copy options from a fixed list, and refuses translate.
import { fakeRun } from './run'
import { ProviderFailure, type CopyRole, type TextProvider } from '@/main/providers/types'
import type { BriefDraft } from '@/shared/schemas/brief'

type TextField = 'campaignName' | 'region' | 'audience' | 'message' | 'offer'
type Field = TextField | 'callToAction' | 'tone' | 'languages' | 'sizes' | 'subject'

const LABELS: Readonly<Record<string, Field>> = {
  'campaign name': 'campaignName',
  region: 'region',
  audience: 'audience',
  message: 'message',
  offer: 'offer',
  'call to action': 'callToAction',
  tone: 'tone',
  languages: 'languages',
  sizes: 'sizes',
  subject: 'subject',
}

const COPY: Readonly<Record<CopyRole, readonly string[]>> = {
  call_to_action: [
    'Shop the collection',
    'Find your fit',
    'Shop now',
    'Discover more',
    'See the range',
    'Get yours today',
    'Explore the new season',
    'Order online',
  ],
  text: [
    'Made for every day',
    'Comfort that lasts',
    'New colours, same quality',
    'Light, strong and simple',
    'Designed to be worn often',
    'Your new favourite',
    'Built for the way you move',
    'Fresh looks for the season',
  ],
}

const list = (value: string) =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')

function subjectOf(value: string): { name: string; description?: string } {
  const at = value.indexOf(' - ')
  if (at < 0) return { name: value }
  return { name: value.slice(0, at).trim(), description: value.slice(at + 3).trim() }
}

// Each line `Label: value`, the label in any letter case. Other lines are ignored. A label
// given twice keeps its last value; Subject adds one subject each time.
export function readBrief(text: string): BriefDraft {
  const draft: BriefDraft = {}
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at < 0) continue
    const field = LABELS[line.slice(0, at).trim().toLowerCase()]
    const value = line.slice(at + 1).trim()
    if (!field || value === '') continue
    if (field === 'languages' || field === 'sizes') draft[field] = list(value)
    else if (field === 'subject') draft.subjects = [...(draft.subjects ?? []), subjectOf(value)]
    else draft[field] = value
  }
  return draft
}

const within = (line: string, maxChars: number) => [...line].slice(0, maxChars).join('').trim()

export function fakeText(): TextProvider {
  return {
    extractBrief: (input, opts) => fakeRun(opts, () => readBrief(input.text)),
    copyOptions: (input, opts) =>
      fakeRun(opts, () =>
        COPY[input.role].slice(0, input.count).map((line) => within(line, input.maxChars)),
      ),
    translate: () =>
      Promise.reject(new ProviderFailure({ kind: 'other', detail: 'Translate is not built yet' })),
  }
}
