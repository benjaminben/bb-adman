// R2P-7 (spec/phases/round-2-platform.md, D6): the reply picker of create_campaign_from_brief
// names the IDs field by field, so nothing else the command returns can reach an agent.
import { describe, expect, it } from 'vitest'
import { briefCreatedFields } from '@/main/mcp/tools/brief-replies'

const CTX = { providers: [] }

const MADE = {
  campaignId: 'spring-glow',
  directionId: 'D1',
  variantId: 'V1',
  subjectIds: ['citrus-glow'],
}

describe('briefCreatedFields [R2P-7; D6]', () => {
  it('keeps the campaign, direction, master variant and subject IDs and drops the rest', () => {
    const extra = { ...MADE, brief: { message: 'Glow' }, paths: ['/Users/made-up/a.png'] }
    expect(briefCreatedFields(extra, CTX)).toEqual(MADE)
  })

  it('adds the imported asset IDs, in brief order, when the files command gave them', () => {
    const files = { ...MADE, assetIds: ['A2', 'A1'], absPaths: ['/Users/made-up/a.png'] }
    expect(briefCreatedFields(files, CTX)).toEqual({ ...MADE, assetIds: ['A2', 'A1'] })
  })
})
