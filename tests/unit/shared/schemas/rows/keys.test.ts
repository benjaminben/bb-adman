import { describe, it, expect } from 'vitest'
import { ROW_KEYS, rowKey } from '../../../../../src/shared/schemas/rows/keys'

describe('row keys [SPEC 4.4]', () => {
  it('names the key fields of all 14 tables', () => {
    expect(ROW_KEYS).toEqual({
      project_meta: ['key'],
      subject: ['id'],
      asset: ['id'],
      campaign: ['id'],
      campaign_subject: ['campaignId', 'subjectId'],
      rule_set: ['campaignId'],
      direction: ['id'],
      variant: ['id'],
      variant_subject: ['variantId', 'subjectId'],
      layer: ['id'],
      background_clip: ['id'],
      job: ['id'],
      report: ['id'],
      variant_check: ['variantId'],
    })
  })

  it('builds the row key text from the key fields, joined with a slash', () => {
    expect(rowKey('subject', { id: 'k3f9q2', name: 'Shoe' })).toBe('k3f9q2')
    expect(rowKey('project_meta', { key: 'assets_dir_rel', value: 'x' })).toBe('assets_dir_rel')
    expect(rowKey('rule_set', { campaignId: 'summer-splash-k3f9q2' })).toBe('summer-splash-k3f9q2')
    expect(rowKey('variant_check', { variantId: 'k3f9q2' })).toBe('k3f9q2')
    expect(
      rowKey('campaign_subject', { campaignId: 'summer-splash-k3f9q2', subjectId: 'bottle-1' }),
    ).toBe('summer-splash-k3f9q2/bottle-1')
    expect(rowKey('variant_subject', { subjectId: 'bottle-1', variantId: 'k3f9q2' })).toBe(
      'k3f9q2/bottle-1',
    )
  })

  it('refuses a row that lacks a key field', () => {
    expect(() => rowKey('campaign_subject', { campaignId: 'c' })).toThrow()
  })
})
