// P7-21: the editor gives its timeline the window API through this scope. The sound choice
// talks to the main process only inside it; outside an editor (a bare transport bar) it draws
// nothing.
import { createContext } from 'react'
import type { AdmanApi } from '@/shared/schemas/api'

export const SoundScope = createContext<AdmanApi | null>(null)
