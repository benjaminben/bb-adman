// P10-10 (spec/phases/phase-10.md, "Design additions", A-246; spec/brief-and-templates.md, the
// MCP tool create_campaign): what create_campaign fills in when an agent leaves out sizes or
// languages. Sizes come from the brief through parseSize, else the three default sizes;
// languages from the brief, else the region table's language. An unknown region leaves the
// languages out, so the command refuses as before.
import { describe, it, expect } from 'vitest'
import { fillCreateDefaults } from '@/shared/campaign/create-defaults'

const SQUARE = { label: '1x1', width: 1080, height: 1080 }
const TALL = { label: '9x16', width: 1080, height: 1920 }
const WIDE = { label: '16x9', width: 1920, height: 1080 }
const PORTRAIT = { label: '4x5', width: 1080, height: 1350 }

const brief = (over: Record<string, unknown> = {}) => ({
  campaignName: 'Spring Fizz',
  region: 'DE',
  audience: 'Hikers',
  message: 'Fresh on the trail',
  subjects: [{ name: 'Flask' }],
  ...over,
})

type Row = [string, Record<string, unknown>, { sizes?: unknown; languages?: unknown }]

const rows: Row[] = [
  [
    'keeps both when the agent gives both',
    { brief: brief({ sizes: ['4x5'], languages: ['fr'] }), sizes: [TALL], languages: ['it'] },
    { sizes: [TALL], languages: ['it'] },
  ],
  [
    'takes the sizes from the brief',
    { brief: brief({ sizes: ['4x5', '1080x1080'] }), languages: ['de'] },
    { sizes: [PORTRAIT, SQUARE], languages: ['de'] },
  ],
  [
    'skips brief sizes it cannot read, and a repeat',
    {
      brief: brief({ sizes: ['/Users/someone/secret.png', 'adman-asset://a1', '4x5', '4:5'] }),
      languages: ['de'],
    },
    { sizes: [PORTRAIT], languages: ['de'] },
  ],
  [
    'gives the three default sizes when the brief has none',
    { brief: brief(), languages: ['de'] },
    { sizes: [SQUARE, TALL, WIDE], languages: ['de'] },
  ],
  [
    'gives the three default sizes when no brief size can be read',
    { brief: brief({ sizes: ['../../etc/passwd', 'big'] }), languages: ['de'] },
    { sizes: [SQUARE, TALL, WIDE], languages: ['de'] },
  ],
  [
    'takes the languages from the brief',
    { brief: brief({ languages: [' fr ', 'nl', 'fr'] }), sizes: [SQUARE] },
    { sizes: [SQUARE], languages: ['fr', 'nl'] },
  ],
  [
    "gives the region's language when the brief has none",
    { brief: brief({ region: 'Germany', languages: [] }), sizes: [SQUARE] },
    { sizes: [SQUARE], languages: ['de'] },
  ],
  [
    'leaves the languages out for a region not in the table',
    { brief: brief({ region: 'Atlantis' }), sizes: [SQUARE] },
    { sizes: [SQUARE] },
  ],
]

describe('fillCreateDefaults [A-246]', () => {
  it.each(rows)('%s', (_name, input, want) => {
    const out = fillCreateDefaults(input)
    expect(out.sizes).toEqual(want.sizes)
    if (want.languages === undefined) expect(out).not.toHaveProperty('languages')
    else expect(out.languages).toEqual(want.languages)
  })

  it('keeps every other field as given', () => {
    const input = { projectId: 'p1', brief: brief(), templateId: 'starter', sizes: [SQUARE] }
    expect(fillCreateDefaults(input)).toMatchObject(input)
  })

  it('does not change the input it was given', () => {
    const input = { brief: brief() }
    fillCreateDefaults(input)
    expect(input).toEqual({ brief: brief() })
  })

  it('leaves the sizes and languages out when there is no brief to read', () => {
    expect(fillCreateDefaults({ projectId: 'p1' })).toEqual({ projectId: 'p1' })
  })
})
