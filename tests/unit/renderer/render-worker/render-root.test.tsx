// P7-8: the render window passes a video variant's clips to the Scene and answers once the
// Scene, clip track included, has settled.
import '../../shared/scene/fake-fonts'
import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { RenderRoot } from '@/renderer/render-worker/render-root/render-root'
import type { RenderRequest } from '@/shared/schemas/render'
import { layer } from '../../shared/scene/fixtures'

const PROJECT = '01JABCDEFGHJKMNPQRSTVWXYZ0'
const STILL = '01JABCDEFGHJKMNPQRSTVWXYZ1'
const background = layer({ id: 'bg', type: 'background', z: 0 })

const request: RenderRequest = {
  requestId: 'r1',
  width: 200,
  height: 200,
  input: {
    projectId: PROJECT,
    variant: { width: 400, height: 400, language: 'en', format: 'video', durationMs: 4000 },
    layers: [background],
    assets: { [STILL]: { kind: 'image', missing: false, width: 10, height: 10 } },
    timeMs: 500,
    mode: 'full',
    clips: [
      {
        id: 'c1',
        assetId: STILL,
        startMs: 0,
        inMs: 0,
        outMs: 1000,
        placement: null,
        soundOn: true,
      },
    ],
  },
}

describe('RenderRoot clips [P7-8]', () => {
  it('draws the clip under the time from its asset address and answers once', async () => {
    const onDone = vi.fn()
    const { container } = render(<RenderRoot request={request} onDone={onDone} />)
    const img = container.querySelector('[data-layer-id="bg"] img')
    expect(img?.getAttribute('src')).toBe(`adman-asset://${PROJECT}/${STILL}`)
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ requestId: 'r1', overflow: {} }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
