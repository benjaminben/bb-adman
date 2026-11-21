import { describe, it, expect } from 'vitest'
import { renderWindowOptions } from '@/main/render/render-window'

// spec/scene.md "Life of the window"; spec/security.md "Rules: the render window".
describe('render window settings [P3-6]', () => {
  it.each([false, true])(
    'keeps the app window walls, hidden and offscreen (dev tools %s)',
    (on) => {
      expect(renderWindowOptions('/app/out/preload/render.cjs', on)).toEqual({
        width: 1,
        height: 1,
        show: false,
        skipTaskbar: true,
        frame: false,
        useContentSize: true,
        paintWhenInitiallyHidden: true,
        transparent: true,
        webPreferences: {
          preload: '/app/out/preload/render.cjs',
          contextIsolation: true,
          sandbox: true,
          nodeIntegration: false,
          webSecurity: true,
          offscreen: true,
          backgroundThrottling: false,
          devTools: on,
        },
      })
    },
  )
})
