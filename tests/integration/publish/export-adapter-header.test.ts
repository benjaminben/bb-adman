// P9-13, review fix 2 (spec/phases/phase-09.md "The export interface"): the publish header is
// put into the HTML report as plain text; a `$` sequence in it is never read as a replacement
// pattern (`$&`, `` $` ``, `$'` would copy parts of the report into the header line).
import fs from 'node:fs'
import { describe, it, expect, afterEach } from 'vitest'
import { exportForPublish } from '@/main/publish/export-adapter'
import { adapterSetUp, type AdapterSetUp } from './export-adapter-setup'

let s: AdapterSetUp | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

describe('the publish header in the HTML report [P9-13 review fix 2]', () => {
  it('keeps $ sequences in the header as they are', async () => {
    s = await adapterSetUp()
    // Not a date, so it is written as given.
    const publishedAt = "$& $` $'"
    const result = await exportForPublish(
      s.fx.core.deps,
      s.input({ publishHeader: { publishedAt, publishNumber: 2 } }),
    )
    const html = result.files.find((f) => f.role === 'report_html')
    const body = fs.readFileSync(html?.absPath as string, 'utf8')
    expect(body).toContain(`<p>Published $&amp; $\` $&#39;, publish 2.</p>`)
    expect(body.split('<body>')).toHaveLength(2)
  })
})
