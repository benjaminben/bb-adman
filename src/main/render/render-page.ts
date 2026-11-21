// spec/scene.md "Life of the window": the render window's page, by the same rule as the app
// window's pageAddress. The development server's /render.html only when that rule picks the
// server; the built render.html in every other case.
import { pageAddress } from '@/main/windows/app-window'

export function renderPageAddress(opts: {
  isPackaged: boolean
  rendererUrl: string | undefined
  builtPage: string
}): string {
  const page = pageAddress(opts)
  return page === opts.builtPage ? page : new URL('render.html', page).href
}
