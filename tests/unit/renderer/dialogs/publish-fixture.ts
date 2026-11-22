// P9-12 test helper: publish.inspect replies with made-up names and paths. Not a test file.
import type { PublishInspect, PublishInspectComponent } from '@/shared/schemas/queries/publish'

export const SHA = 'a'.repeat(64)

export function component(over: Partial<PublishInspectComponent>): PublishInspectComponent {
  return {
    assetId: '01JD0000000000000000000001',
    displayName: 'Beach at dawn',
    kind: 'image',
    folder: 'backgrounds',
    localPath: '/Users/ann/Pictures/Summer/beach-at-dawn.png',
    problem: null,
    share: null,
    sha256: null,
    ...over,
  }
}

export function font(over: Partial<PublishInspectComponent>): PublishInspectComponent {
  return component({
    assetId: '01JD0000000000000000000009',
    displayName: 'Harbor Sans',
    kind: 'font',
    folder: 'fonts',
    localPath: '/Users/ann/Library/Fonts/HarborSans-Bold.ttf',
    share: 'not_shared',
    sha256: SHA,
    ...over,
  })
}

export const COMPONENTS: PublishInspectComponent[] = [
  component({}),
  component({
    assetId: '01JD0000000000000000000002',
    displayName: 'Kettle Co. mark',
    folder: 'logos',
    localPath: '/Users/ann/Brand/kettle-mark.png',
  }),
  component({
    assetId: '01JD0000000000000000000003',
    displayName: 'Old hero',
    folder: 'images',
    localPath: '/Users/ann/Pictures/old-hero.png',
    problem: 'missing',
  }),
]

export const STORAGES: PublishInspect['storages'] = [
  { id: 's3', label: 'Amazon S3', ready: 'ready' },
  { id: 'dropbox', label: 'Dropbox', ready: 'not_signed_in' },
]

export function inspectReply(over: Partial<PublishInspect> = {}): PublishInspect {
  return { storages: STORAGES, existing: null, components: COMPONENTS, ...over }
}

type Published = NonNullable<PublishInspect['existing']>

export const NOTHING_PUBLISHED: Published = {
  files: 0,
  publishNumber: null,
  publishedAt: null,
  otherProject: false,
}

export const PUBLISHED: Published = {
  files: 14,
  publishNumber: 3,
  publishedAt: '2026-11-02T15:30:00.000Z',
  otherProject: false,
}
