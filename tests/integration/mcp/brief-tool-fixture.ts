// R2P-7: the import set-up with helpers for create_campaign_from_brief: the D2 Markdown example
// with chosen pictures, pictures already in the project, and readers for the rows a brief
// makes. Made-up names only. Not a test file.
import { data } from '../core-fixture'
import { importSetUp, mp4Bytes, pngBytes, type ImportSetUp } from './import-assets-fixture'
import type { ToolReply, ToolSession } from './tool-client'

export type BriefSetUp = ImportSetUp & {
  // Imports one file as the user and gives its asset ID.
  imported: (rel: string, bytes: Uint8Array, subjectId?: string) => Promise<string>
  png: (rel: string, n: number, subjectId?: string) => Promise<string>
  video: (rel: string) => Promise<string>
  rows: (sql: string) => Array<Record<string, unknown>>
  counts: () => Record<string, number>
  tool: (text: string) => Promise<ToolReply>
}

// The D2 example (made-up names), its one subject's pictures as given.
export function markdownBrief(pictures: string[], subject = 'ID: citrus-glow'): string {
  return [
    '# Spring Glow launch',
    '',
    'Region: Canada',
    'Audience: Adults 25 to 40 who buy skin care online',
    'Call to action: Shop the serum',
    'Tone: Warm and plain',
    '',
    '## Message',
    'Glow that lasts from morning to night.',
    '',
    '## Languages',
    '- en',
    '- fr',
    '',
    '## Sizes',
    '- 1:1',
    '- 9:16',
    '',
    '## Required words (en)',
    '- serum',
    '',
    '## Subjects',
    '',
    '### Citrus Glow serum',
    subject,
    'Description: A 30 ml glass dropper bottle with an orange label',
    ...(pictures.length > 0 ? ['Pictures:', ...pictures.map((p) => `- ${p}`)] : []),
    '',
    '## Copy (fr)',
    'Headline: Un éclat qui dure',
    'Call to action: Découvrir le sérum',
  ].join('\n')
}

const TABLES = ['campaign', 'subject', 'asset', 'campaign_subject', 'variant', 'layer']

export async function briefSetUp(): Promise<BriefSetUp> {
  const x = await importSetUp()
  const db = () => x.core.projects.requireOpen(x.projectId).db
  const imported = async (rel: string, bytes: Uint8Array, subjectId?: string) => {
    const reply = await x.user('asset.import', {
      projectId: x.projectId,
      paths: [x.put(rel, bytes)],
      library: 'asset',
      copy: true,
      ...(subjectId ? { subjectId } : {}),
    })
    const id = data<{ assetIds: string[] }>(reply).assetIds[0]
    if (!id) throw new Error('no asset was imported')
    return id
  }
  let open: Promise<ToolSession> | undefined
  return {
    ...x,
    imported,
    png: (rel, n, subjectId) => imported(rel, pngBytes(n), subjectId),
    video: (rel) => imported(rel, mp4Bytes()),
    rows: (sql) => db().prepare(sql).all() as Array<Record<string, unknown>>,
    counts: () =>
      Object.fromEntries(
        TABLES.map((t) => {
          const row = db().prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }
          return [t, row.n]
        }),
      ),
    async tool(text) {
      open ??= x.session()
      return (await open).call('create_campaign_from_brief', { project_id: x.projectId, text })
    },
  }
}
