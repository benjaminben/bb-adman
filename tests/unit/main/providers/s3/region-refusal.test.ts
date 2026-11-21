import { describe, it, expect } from 'vitest'
import { regionRefusal } from '@/main/providers/s3/pinned-host'

const CHINA = 'Amazon S3 regions in China are not supported in this build.'
const NOT_A_REGION =
  'That is not an Amazon S3 region. Storage services that copy S3 are not supported in this build.'

describe('regionRefusal: standard Amazon regions only [SPEC 14 1.39 S3, Z4; FR-308]', () => {
  it.each(['cn-north-1', 'cn-northwest-1'])('refuses the China region %s', (region) => {
    expect(regionRefusal(region)).toBe(CHINA)
  })

  it.each(['https://example.com', 'minio.local:9000'])('refuses %s as not a region', (region) => {
    expect(regionRefusal(region)).toBe(NOT_A_REGION)
  })

  it.each(['eu-west-1', 'us-east-1'])('accepts %s', (region) => {
    expect(regionRefusal(region)).toBeNull()
  })
})

describe('regionRefusal: an empty region is not set up yet [SPEC 14 1.40 AA6]', () => {
  it('gives null for the empty region', () => {
    expect(regionRefusal('')).toBeNull()
  })

  it('refuses a region made of a space as not a region', () => {
    expect(regionRefusal(' ')).toBe(NOT_A_REGION)
  })
})
