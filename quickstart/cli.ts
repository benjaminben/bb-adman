// The quickstart: one brief in, one finished ad per language and size out, with no app window,
// no project file and no database. Run it with `npm run quickstart -- --help`.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pictureType } from '@/main/providers/picture-type'
import { ProviderFailure, type ImageFile } from '@/main/providers/types'
import { parseArgs, USAGE, type Args } from './args'
import { campaignFolder, writeAd, type WrittenAd } from './output'
import { readPlan, type Plan } from './plan'
import { providersFor, type Providers } from './providers'
import { runQuickstart, stepCount, type Report } from './run'
import { openStudio } from './studio'

const here = dirname(fileURLToPath(import.meta.url))
const say = (line = '') => void process.stdout.write(`${line}\n`)

// A failure the person can act on: its sentence is printed as it is, with no stack.
class Stop extends Error {}

const isWebp = (bytes: Uint8Array) =>
  bytes.length > 12 &&
  Buffer.from(bytes.subarray(0, 4)).toString('latin1') === 'RIFF' &&
  Buffer.from(bytes.subarray(8, 12)).toString('latin1') === 'WEBP'

// Each subject's photos, read from beside the brief (or from a full path).
async function readReferences(plan: Plan, briefFolder: string): Promise<ImageFile[]> {
  const files: ImageFile[] = []
  for (const name of plan.subjects.flatMap((subject) => subject.pictures)) {
    const path = isAbsolute(name) ? name : resolve(briefFolder, name)
    const bytes = await readFile(path).catch(() => {
      throw new Stop(`The photo "${name}" was not found beside the brief.`)
    })
    const mime = pictureType(bytes) ?? (isWebp(bytes) ? 'image/webp' : null)
    if (!mime) throw new Stop(`The photo "${name}" is not a PNG, JPEG or WebP picture.`)
    files.push({ bytes: new Uint8Array(bytes), mime })
  }
  return files
}

function sayPlan(plan: Plan, args: Args, providers: Providers, photos: number): void {
  const { brief, languages, sizes } = plan
  say(`Campaign   ${brief.campaignName} (${brief.region})`)
  say(`Subjects   ${plan.subjects.map((s) => s.name).join(', ')} (${photos} photos)`)
  say(
    `Provider   ${args.provider}: pictures ${providers.models.image}, text ${providers.models.text}`,
  )
  say(`Languages  ${languages.join(', ')}`)
  say(`Sizes      ${sizes.map((s) => `${s.label} (${s.width}x${s.height})`).join(', ')}`)
  say()
  say(`${languages.length * sizes.length} ads to make:`)
  for (const language of languages) {
    say(`  ${language.padEnd(8)}${sizes.map((s) => s.label).join('  ')}`)
  }
  const calls = [
    '1 picture',
    '1 text placement',
    ...(plan.fills.length > 0 ? [`${plan.fills.length} picture extends`] : []),
    ...(plan.translate.length > 0 ? [`translation to ${plan.translate.join(', ')}`] : []),
  ]
  say()
  say(`AI calls: ${calls.join(', ')}`)
  say()
}

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

async function main(args: Args): Promise<void> {
  const briefPath = resolve(args.brief ?? join(here, 'brief.yaml'))
  const text = await readFile(briefPath, 'utf8').catch(() => {
    throw new Stop(`The brief "${briefPath}" could not be read.`)
  })
  const planned = readPlan(text, extname(briefPath).toLowerCase() === '.json' ? 'json' : 'yaml')
  if (!planned.ok) throw new Stop(planned.message)
  const { plan } = planned
  const references = await readReferences(plan, dirname(briefPath))
  const providers = providersFor(args)
  say('Adman quickstart')
  say()
  sayPlan(plan, args, providers, references.length)
  const total = stepCount(plan) + 1
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
      references,
      prompt: args.prompt,
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
