// R2E-7 (spec/phases/round-2-editor.md D5): which still a generated clip replaces, where the
// clip starts and how long it runs, or none.
import { describe, it, expect } from 'vitest'
import { stillToReplace, type StillTrackClip } from '@/main/clips/still-to-replace'

const clip = (
  id: string,
  assetId: string,
  startMs: number,
  lengthMs: number,
  picture = true,
): StillTrackClip => ({ id, assetId, startMs, inMs: 0, outMs: lengthMs, picture })

const plan = (track: StillTrackClip[], over: Partial<Parameters<typeof stillToReplace>[0]> = {}) =>
  stillToReplace({ track, backgroundAssetId: 'BG', fileMs: 5000, postMs: 8000, ...over })

describe('stillToReplace [R2E-7, D5]', () => {
  it("replaces the clip whose picture is the background's current source", () => {
    const track = [clip('V0', 'VID', 0, 1000, false), clip('S1', 'BG', 1000, 7000)]
    expect(plan(track)).toEqual({ stillId: 'S1', startMs: 1000, lengthMs: 5000 })
  })

  it('replaces the only clip of the track when it is a picture', () => {
    expect(plan([clip('S1', 'OLD', 0, 8000)])).toEqual({
      stillId: 'S1',
      startMs: 0,
      lengthMs: 5000,
    })
  })

  it('replaces no clip when the only clip is a video', () => {
    expect(plan([clip('V1', 'VID', 0, 8000, false)])).toBeNull()
  })

  it("replaces none when several clips are on the track and none is the background's", () => {
    const track = [clip('S1', 'OTHER', 0, 2000), clip('S2', 'MORE', 2000, 2000)]
    expect(plan(track)).toBeNull()
  })

  it("replaces none when the background's asset is on the track as a video", () => {
    const track = [clip('V1', 'BG', 0, 2000, false), clip('S2', 'MORE', 2000, 2000)]
    expect(plan(track)).toBeNull()
  })

  it('replaces none on an empty track', () => {
    expect(plan([])).toBeNull()
  })

  it('cuts the clip before the next clip on the track', () => {
    const track = [clip('S1', 'BG', 0, 3000), clip('V2', 'VID', 3000, 2000, false)]
    expect(plan(track)).toEqual({ stillId: 'S1', startMs: 0, lengthMs: 3000 })
  })

  it("cuts the clip before the post's end", () => {
    const track = [clip('S1', 'BG', 6000, 2000)]
    expect(plan(track)).toEqual({ stillId: 'S1', startMs: 6000, lengthMs: 2000 })
  })

  it('replaces none when less than the shortest clip would be left', () => {
    expect(plan([clip('S1', 'BG', 7950, 3000)])).toBeNull()
    expect(plan([clip('S1', 'BG', 0, 3000)], { postMs: 0 })).toBeNull()
    expect(plan([clip('S1', 'BG', 0, 3000)], { fileMs: 99 })).toBeNull()
  })

  it('keeps the whole file when it fits', () => {
    expect(plan([clip('S1', 'BG', 0, 8000)], { fileMs: 8000 })).toEqual({
      stillId: 'S1',
      startMs: 0,
      lengthMs: 8000,
    })
  })
})
