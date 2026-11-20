// Renders a component inside the app context over a fake window.api, and runs axe-core.
import { render } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { AppProvider } from '../../../src/renderer/app/app-context'
import { createAppStore } from '../../../src/renderer/stores/app-store'
import { makeFakeApi } from './fake-api'

export async function renderApp(ui: ReactElement, fake = makeFakeApi()) {
  const store = createAppStore(fake.api)
  await store.getState().refresh()
  const view = render(
    <AppProvider api={fake.api} store={store}>
      {ui}
    </AppProvider>,
  )
  return { ...view, store, fake }
}

// Colour contrast needs a real layout engine, which jsdom lacks; tokens are chosen for 4.5:1.
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const results = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } })
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)
}
