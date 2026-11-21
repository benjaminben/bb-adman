import { useCallback, useMemo, useRef } from 'react'
import { Scene } from '@/shared/scene/scene'
import type { SceneAsset, SceneSettled } from '@/shared/scene/types'
import type { RenderDone, RenderRequest } from '@/shared/schemas/render'
import { assetUrl } from '@/renderer/ui/asset-url'
import styles from './render-root.module.css'

type Props = { request: RenderRequest; onDone: (reply: RenderDone) => void }

// spec/scene.md "One draw" step 3: builds each asset's address, draws the Scene scaled to the
// asked width from the top-left corner, and answers once, when the Scene has settled.
export function RenderRoot({ request, onDone }: Props) {
  const { requestId, input, width } = request
  const assets = useMemo(() => {
    const entries = Object.entries(input.assets).map(([id, asset]): [string, SceneAsset] => [
      id,
      { ...asset, url: assetUrl(input.projectId, id), version: 0 },
    ])
    return Object.fromEntries(entries)
  }, [input])
  const answered = useRef(false)
  const settled = useCallback(
    ({ overflow }: SceneSettled) => {
      if (answered.current) return
      answered.current = true
      onDone({ requestId, overflow })
    },
    [requestId, onDone],
  )
  return (
    <div className={styles.frame} style={{ transform: `scale(${width / input.variant.width})` }}>
      <Scene
        variant={input.variant}
        layers={input.layers}
        assets={assets}
        timeMs={input.timeMs}
        mode={input.mode}
        onSettled={settled}
      />
    </div>
  )
}
