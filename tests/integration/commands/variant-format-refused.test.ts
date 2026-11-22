// P7-10, the named test (spec/testing.md): variant.setFormat is refused in each direction when
// the target cell already has a variant, and nothing is written [R-20]. Also an undo refused
// because the cell was taken after the change, under the four refusal rules.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeFormatBus, type FormatBus } from './format-fixture'

let bus: FormatBus
beforeEach(async () => {
  bus = await makeFormatBus()
})
afterEach(() => bus.cleanup())

const toVideo = () => bus.db.prepare("UPDATE variant SET format = 'video' WHERE id = ?")

describe('variant.setFormat grid test [R-20]', () => {
  it('refuses image to video when the direction has a video post at the size and language', async () => {
    bus.copyVariant({ sizeLabel: bus.variant().sizeLabel, format: 'video' })
    const error = await expectRefused(
      bus,
      () => bus.setFormat('video'),
      'RULE_VIOLATION',
      'video_post_exists',
    )
    expect(error.message).toBe('This direction already has a video post at this size and language.')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('refuses video to image when the direction has an image post at the size and language', async () => {
    const other = bus.copyVariant({ sizeLabel: bus.variant().sizeLabel, format: 'video' })
    const error = await expectRefused(
      bus,
      () => bus.setFormat('image', other),
      'RULE_VIOLATION',
      'image_post_exists',
    )
    expect(error.message).toBe(
      'This direction already has an image post at this size and language.',
    )
    expect(bus.undoStateOf(other)).toEqual({ canUndo: false, canRedo: false })
  })

  it('allows the change when the taken cell is another language or size', async () => {
    bus.copyVariant({ sizeLabel: bus.variant().sizeLabel, language: 'fr', format: 'video' })
    bus.copyVariant({ sizeLabel: 'story', format: 'video' })
    expect(await bus.setFormat('video')).toMatchObject({ ok: true })
  })

  it('refuses an undo when the cell was taken after the change; the entry stays', async () => {
    await bus.setFormat('video')
    const other = bus.copyVariant({ sizeLabel: bus.variant().sizeLabel, format: 'image' })
    await expectRefused(bus, () => bus.history('undo'), 'RULE_VIOLATION', 'image_post_exists')
    expect(bus.variant().format).toBe('video')
    expect(bus.clips()).toHaveLength(1)
    expect(bus.undoState()).toEqual({ canUndo: true, canRedo: false })
    bus.db.prepare('DELETE FROM variant WHERE id = ?').run(other)
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.variant().format).toBe('image')
  })

  it('refuses a redo when the cell was taken after the undo; the entry stays', async () => {
    await bus.setFormat('video')
    await bus.history('undo')
    bus.copyVariant({ sizeLabel: bus.variant().sizeLabel, format: 'video' })
    await expectRefused(bus, () => bus.history('redo'), 'RULE_VIOLATION', 'video_post_exists')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: true })
  })
})

describe('variant.setFormat other refusals', () => {
  it('answers NOT_FOUND for a variant the project does not hold', async () => {
    const error = await expectRefused(bus, () => bus.setFormat('video', 'gone'), 'NOT_FOUND')
    expect(error.message).toBe('That variant was not found.')
  })

  it.each([['gif'], [undefined]])('refuses the format %s with INVALID_INPUT', async (format) => {
    await expectRefused(bus, () => bus.setFormat(format as string), 'INVALID_INPUT')
  })

  it('refuses an undo clip from the agent, and with a change to video', async () => {
    const clip = { undoClipId: 'K1' }
    const send = (actor: 'user' | 'agent', format: string) => () =>
      bus.bus.execute(
        'variant.setFormat',
        { projectId: bus.projectId, variantId: bus.variantId, format, ...clip },
        { actor },
      )
    toVideo().run(bus.variantId)
    await expectRefused(bus, send('agent', 'image'), 'INVALID_INPUT')
    await expectRefused(bus, send('user', 'video'), 'INVALID_INPUT')
  })

  it('refuses an undo clip that belongs to another variant, and keeps that clip', async () => {
    const other = bus.copyVariant()
    await bus.setFormat('video', other)
    const [clip] = bus.clips(other)
    toVideo().run(bus.variantId)
    const send = () =>
      bus.user('variant.setFormat', {
        variantId: bus.variantId,
        format: 'image',
        undoClipId: clip?.id,
      })
    await expectRefused(bus, send, 'INVALID_INPUT')
    expect(bus.clips(other)).toHaveLength(1)
  })
})
