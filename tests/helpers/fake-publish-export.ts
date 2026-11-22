// P9-10 test helper: an exportForPublish port that writes two small ads, report-x.html,
// report-x.json and a translation sheet into the work folder it is given, records each input
// (the header among them), and answers the files written. A test may change the list it answers
// or make it fail. Nothing here is a real export.
import fs from 'node:fs'
import path from 'node:path'
import type {
  ExportedFile,
  ExportForPublishInput,
  ExportForPublishResult,
  PublishPorts,
} from '@/main/publish/ports'

export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

export const ADS = [
  { relPath: 'Summer/1080x1080/en-vaaaaa.png', variantId: 'vaaaaa' },
  { relPath: 'Summer/1080x1920/en-vbbbbb.png', variantId: 'vbbbbb' },
]

export type FakeExport = {
  port: PublishPorts['exportForPublish']
  inputs: ExportForPublishInput[]
  // Changes the files answered, after they are written.
  change: (files: ExportedFile[], root: string) => ExportedFile[]
  // Called once the files are written, before the answer.
  after: (input: ExportForPublishInput) => Promise<void> | void
  fail: Error | null
}

function write(root: string, rel: string, body: string | Buffer): string {
  const file = path.join(root, ...rel.split('/'))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  return file
}

export function fakePublishExport(): FakeExport {
  const fake: FakeExport = {
    inputs: [],
    change: (files) => files,
    after: () => undefined,
    fail: null,
    async port(_deps, input): Promise<ExportForPublishResult> {
      fake.inputs.push(input)
      input.onProgress(0.5)
      if (fake.fail) throw fake.fail
      const root = path.join(input.outputRoot, input.campaignId)
      const header = `Publish ${input.publishHeader?.publishNumber ?? 0}`
      const files: ExportedFile[] = [
        ...ADS.map((ad) => ({
          role: 'ad' as const,
          relPath: ad.relPath,
          absPath: write(root, ad.relPath, PNG),
        })),
        {
          role: 'report_html',
          relPath: 'report-x.html',
          absPath: write(root, 'report-x.html', `<h1>${header}</h1>`),
        },
        {
          role: 'report_json',
          relPath: 'report-x.json',
          absPath: write(root, 'report-x.json', JSON.stringify({ header })),
        },
        {
          role: 'translations_csv',
          relPath: 'translations.csv',
          absPath: write(root, 'translations.csv', 'key,en\nprice,Ten\n'),
        },
      ]
      const answered = fake.change(files, root)
      await fake.after(input)
      input.onProgress(1)
      return { files: answered, variantIds: ADS.map((ad) => ad.variantId) }
    },
  }
  return fake
}
