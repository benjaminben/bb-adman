// The run over every ad set, one after the other: the set's AI calls, then each of its ads drawn
// into the set's folder with the picture it uses, then the app's checks on each ad. A set's
// pictures are handed to the drawing page under the same names as the set before, so a set is
// drawn before the next one starts.
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { setFolder, setPhotos, type AdSet } from './ad-sets'
import type { Brand, SubjectPhoto } from './brief-files'
import { adChecks } from './checks'
import { writeAd } from './output'
import type { Plan } from './plan'
import type { Providers } from './providers'
import {
  adRecord,
  relativeFolder,
  type AdRecord,
  type PictureRecord,
  type SetRecord,
} from './report'
import { runAdSet, type Progress, type RunResult } from './run'
import type { Studio } from './studio'

export type MakeAdsInput = {
  plan: Plan
  sets: AdSet[]
  // The subject photos as read, in the order of plan.subjects.
  photos: SubjectPhoto[][]
  providers: Providers
  studio: Studio
  brand: Brand
  // The logo file's last part, or null when the run has no logo.
  logoName: string | null
  prompt: string | null
  aiLayout: boolean
  campaign: string
  progress: Progress
  // Told as each set starts, so the person can tell the sets apart.
  onSet(set: AdSet): void
}

export type MadeAds = { sets: SetRecord[]; ads: AdRecord[] }

function picturesOf(photos: SubjectPhoto[], first: CampaignSize, run: RunResult): PictureRecord[] {
  return [
    ...photos.map((photo): PictureRecord => ({ from: 'given', file: photo.name })),
    { from: 'made', size: first.label },
    ...[...run.fills.keys()].map((size): PictureRecord => ({ from: 'made', size })),
  ]
}

export async function makeAds(input: MakeAdsInput): Promise<MadeAds> {
  const { studio, campaign, progress } = input
  const made: MadeAds = { sets: [], ads: [] }
  for (const set of input.sets) {
    input.onSet(set)
    const photos = setPhotos(set, input.photos)
    const run = await runAdSet({
      plan: set.plan,
      providers: input.providers,
      studio,
      references: photos.map((photo) => photo.file),
      brand: input.brand,
      prompt: input.prompt,
      aiLayout: input.aiLayout,
      progress,
    })
    progress.start(`Drawing ${run.variants.length} ads and their layers, and checking them`)
    for (const variant of run.variants) {
      const picture = run.fills.get(variant.size.label) ?? run.picture
      const written = await writeAd(studio, setFolder(campaign, set), variant, picture)
      const results = adChecks(set.plan, variant, written.overflow, input.logoName)
      made.ads.push(adRecord(relativeFolder(campaign, written.folder), results))
    }
    progress.end()
    const first = set.plan.sizes[0] as CampaignSize
    const { prompt, calls } = run
    made.sets.push({ name: set.name, prompt, pictures: picturesOf(photos, first, run), calls })
  }
  return made
}
