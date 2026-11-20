import { useEffect, useState } from 'react'
import { AppProvider } from './app-context'
import { AppShell } from './app-shell'
import { createAppStore } from '../stores/app-store'

export function App() {
  const [store] = useState(() => createAppStore(window.api))
  useEffect(() => {
    const stop = store.getState().subscribe()
    void store.getState().refresh()
    return stop
  }, [store])
  return (
    <AppProvider api={window.api} store={store}>
      <AppShell />
    </AppProvider>
  )
}
