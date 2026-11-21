import { describe, it, expect, expectTypeOf } from 'vitest'
import { EVENT_NAMES, type EventMap } from '@/shared/schemas/events'

describe('thumbnail.changed [spec/editor-commands.md, Event thumbnail.changed]', () => {
  it('is listed, and carries the project and variant IDs only: no picture, no path', () => {
    expect(EVENT_NAMES).toContain('thumbnail.changed')
    expectTypeOf<EventMap['thumbnail.changed']>().toEqualTypeOf<{
      projectId: string
      variantId: string
    }>()
  })
})
