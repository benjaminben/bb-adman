// The quickstart: one brief in, one finished ad per language and size out, with no app window,
// no project file and no database. Run it with `npm run quickstart -- --help`.
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ProviderFailure } from '@/main/providers/types'
import { parseArgs, USAGE, type Args } from './args'
import { readBrand, readSubjectPhotos } from './brief-files'
import { chooseBrief, listExamples } from './examples'
import { lookNoteLine } from './notes'
import { campaignFolder, writeAd, type WrittenAd } from './output'
import { readPlan } from './plan'
import { providersFor } from './providers'
import { runQuickstart, stepCount, type Report } from './run'
import { planLines } from './say-plan'
import { openStudio } from './studio'

const here = dirname(fileURLToPath(import.meta.url))
const say = (line = '') => void process.stdout.write(`${line}\n`)

// A failure the person can act on: its sentence is printed as it is, with no stack.
class Stop extends Error {}

function reporter(total: number): Report {
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
  const chosen = chooseBrief(args, examples, await listExamples(examples))
  if (!chosen.ok) throw new Stop(chosen.message)
  const text = await readFile(chosen.path, 'utf8').catch(() => {
    throw new Stop(`The brief "${basename(chosen.path)}" could not be read.`)
  })
  return { text, path: chosen.path }
}

async function main(args: Args): Promise<void> {
  const brief = await readBrief(args)
  const syntax = extname(brief.path).toLowerCase() === '.json' ? 'json' : 'yaml'
  const planned = readPlan(brief.text, syntax)
  if (!planned.ok) throw new Stop(planned.message)
  const { plan } = planned
  const photos = await readSubjectPhotos(plan, dirname(brief.path))
  const brand = await readBrand(plan, dirname(brief.path))
  const providers = providersFor(args)
  say('Adman quickstart')
  say()
  const notes = [...photos.notes, ...brand.notes, ...plan.look.notes.map(lookNoteLine)]
  for (const note of notes) say(`Note: ${note}`)
  if (notes.length > 0) say()
  for (const line of planLines(plan, args, providers, brand, photos.files.length)) say(line)
  const total = stepCount(plan, args.aiLayout) + 1
  const report = reporter(total)
  const campaign = campaignFolder(
    resolve(args.out ?? join(here, 'output')),
    plan.brief.campaignName,
  )
  const studio = await openStudio()
  const written: WrittenAd[] = []
  try {
    const { variants, prompt } = await runQuickstart({
      plan,
      providers,
      studio,
      references: photos.files,
      brand,
      prompt: args.prompt,
      aiLayout: args.aiLayout,
      report,
    })
    report.start(`Drawing ${variants.length} ads and their layers`)
    for (const variant of variants) written.push(await writeAd(studio, campaign, variant))
    report.end()
    const run = { campaign: plan.brief.campaignName, models: providers.models, prompt }
    await writeFile(join(campaign, 'run.json'), `${JSON.stringify(run, null, 2)}\n`)
  } finally {
    await studio.close()
  }
  say()
  say(`Wrote ${written.length} ads to ${relative(process.cwd(), campaign) || campaign}`)
  for (const ad of written) {
    const warning =
      ad.overflowing.length > 0 ? `  (does not fit: ${ad.overflowing.join(', ')})` : ''
    say(`  ${join(ad.language, ad.size, 'final.png')}${warning}`)
  }
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
