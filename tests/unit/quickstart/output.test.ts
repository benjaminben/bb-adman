import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { masterLayers, planVariants } from '../../../quickstart/layers'
import { adFolder, campaignFolder, layerFile, layoutOf, safeName } from '../../../quickstart/output'
import { readPlan } from '../../../quickstart/plan'

const BRIEF = `
campaignName: "../Été: Garden/Party"
region: France
audience: Gardeners
message: Grow something
subjects:
  - name: Watering can
languages: ['../../en']
sizes: ['4:5']
`

function variant() {
  const result = readPlan(BRIEF, 'yaml')
  if (!result.ok) throw new Error(result.message)
  const [first] = planVariants(result.plan, masterLayers(result.plan), { width: 8, height: 8 })
  if (!first) throw new Error('no variant')
  return first
}

describe('quickstart output names', () => {
  it('keeps letters and digits and turns the rest into single dashes', () => {
    expect(safeName('  Summer Splash! ', 'x')).toBe('Summer-Splash')
    expect(safeName('../..', 'fallback')).toBe('fallback')
  })

  it('never lets a brief name a folder outside the output folder', () => {
    const campaign = campaignFolder('root', '../Été: Garden/Party')
    expect(campaign).toBe(join('root', 'ete-garden-party'))
    expect(adFolder(campaign, variant())).toBe(join(campaign, 'en', '4x5'))
  })

  it('names each layer file by its place in the stack', () => {
    expect(variant().layers.map(layerFile)).toEqual(['1-background.png', '2-headline.png'])
  })

  it('writes the layout as numbers, lowest layer first', () => {
    const layout = layoutOf(variant())
    expect(layout.size).toEqual({ label: '4x5', width: 1080, height: 1350 })
    expect(layout.layers.map((l) => l.file)).toEqual([
      'layers/1-background.png',
      'layers/2-headline.png',
    ])
    expect(layout.layers[1]).toMatchObject({
      key: 'headline',
      type: 'text',
      text: 'Grow something',
    })
  })
})
