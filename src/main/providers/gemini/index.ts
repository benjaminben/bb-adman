// This provider's adapters (SPEC 6, 6.2). Pictures from Phase 2; layout and text from P4-4.
import type { ProviderAdapters } from '@/main/providers/types'
import { geminiImage } from './image'
import { geminiLayout } from './layout'
import { geminiText } from './text'

export const adapters: ProviderAdapters = {
  image: (ctx) => geminiImage(ctx),
  layout: (ctx) => geminiLayout(ctx),
  text: (ctx) => geminiText(ctx),
}
