// The quickstart: one brief in, one finished ad per language and size out, with no app window,
// no project file and no database. Run it with `npm run quickstart -- --help`.
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProviderFailure } from '@/main/providers/types'
import { pictureName } from '@/shared/brief/picture-name'
import { adSetsOf, setPhotos } from './ad-sets'
import { DEFAULT_EXAMPLE, parseArgs, USAGE, type Args } from './args'
import { readBrand, readSubjectPhotos } from './brief-files'
import { chooseBrief, listExamples } from './examples'
import { makeAds, type MadeAds } from './make-ads'
import { askExample } from './pick-example'
import { lookNoteLine } from './notes'
import { campaignFolder } from './output'
import { readPlan } from './plan'
import { providersFor } from './providers'
import { adLine, reportOf, totalLine, type AdRecord } from './report'
import { stepCount, type Progress } from './run'
import { planLines } from './say-plan'
import { openStudio } from './studio'

const here = dirname(fileURLToPath(import.meta.url))
const say = (line = '') => void process.stdout.write(`${line}\n`)

// A failure the person can act on: its sentence is printed as it is, with no stack.
class Stop extends Error {}

function reporter(total: number): Progress {
  let at = 0
  let began = 0
  return {
    start(label) {
      at += 1
      began = Date.now()
      process.stdout.write(`[${at}/${total}] ${label}... `)
    },
    end: () => say(`done (${((Date.now() - began) / 1000).toFixed(1)} s)`),
    note: (text) => say(`\n      note: ${text}`),
  }
}

async function readBrief(args: Args): Promise<{ text: string; path: string }> {
  const examples = join(here, 'examples')
  const found = await listExamples(examples)
  // With no example and no brief named, the run starts by asking which example.
  const asked = args.brief === null && args.example === null
  const example = asked ? await askExample(examples, found, say) : args.example
  if (example === null && asked) throw new Stop('No example was chosen.')
  const chosen = chooseBrief(
    { brief: args.brief, example: example ?? DEFAULT_EXAMPLE },
    examples,
    found,
  )
  if (!chosen.ok) throw new Stop(chosen.message)
  const text = await readFile(chosen.path, 'utf8').catch(() => {
    throw new Stop(`The brief "${basename(chosen.path)}" could not be read.`)
  })
  return { text, path: chosen.path }
}

function sayResults(campaign: string, ads: AdRecord[]): void {
  const shown = relative(process.cwd(), campaign) || campaign
  say()
  say(`Wrote ${ads.length} ads to ${shown}, with report.json:`)
  const width = Math.max(...ads.map((ad) => ad.folder.length))
  for (const ad of ads) say(adLine(ad, width))
  say()
  say(totalLine(ads))
}

async function main(args: Args): Promise<void> {
  say('Adman quickstart')
  say()
  const brief = await readBrief(args)
  const syntax = extname(brief.path).toLowerCase() === '.json' ? 'json' : 'yaml'
  const planned = readPlan(brief.text, syntax)
  if (!planned.ok) throw new Stop(planned.message)
  const { plan } = planned
  const photos = await readSubjectPhotos(plan, dirname(brief.path))
  const brand = await readBrand(plan, dirname(brief.path))
  const providers = providersFor(args)
  const sets = adSetsOf(plan)
  const notes = [...photos.notes, ...brand.notes, ...plan.look.notes.map(lookNoteLine)]
  for (const note of notes) say(`Note: ${note}`)
  if (notes.length > 0) say()
  const counts = sets.map((set) => setPhotos(set, photos.bySubject).length)
  for (const line of planLines(plan, sets, args, providers, brand, counts)) say(line)
  const progress = reporter(sets.length * stepCount(plan, args.aiLayout))
  const campaign = campaignFolder(
    resolve(args.out ?? join(here, 'output')),
    plan.brief.campaignName,
  )
  const logoText = plan.brandFiles.find((file) => file.role === 'logo')?.text
  const studio = await openStudio()
  let made: MadeAds
  try {
    made = await makeAds({
      plan,
      sets,
      photos: photos.bySubject,
      providers,
      studio,
      brand,
      logoName: brand.logo && logoText !== undefined ? pictureName(logoText) : null,
      prompt: args.prompt,
      aiLayout: args.aiLayout,
      campaign,
      progress,
      onSet: (set) => {
        if (set.name !== null) say(`${set.name}:`)
      },
    })
  } finally {
    await studio.close()
  }
  const report = reportOf({ models: providers.models, notes, ...made })
  await writeFile(join(campaign, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  sayResults(campaign, made.ads)
}

function sayFailure(error: unknown): void {
  say()
  if (error instanceof Stop) return say(error.message)
  if (error instanceof ProviderFailure) {
    const { kind, detail } = error.error
    return say(`The provider could not finish (${kind}${detail ? `: ${detail}` : ''}).`)
  }
  say(error instanceof Error ? error.message : 'The quickstart stopped on an unknown error.')
}

const parsed = parseArgs(process.argv.slice(2), process.env)
if (!parsed.ok) {
  say(parsed.message)
  process.exitCode = 1
} else if (parsed.args.help) {
  say(USAGE)
} else {
  await main(parsed.args).catch((error: unknown) => {
    sayFailure(error)
    process.exitCode = 1
  })
}
