import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// The one owner of the @/ import alias (spec/structure.md). @/ means src/.
const root = fileURLToPath(new URL('.', import.meta.url))

export const srcAlias = { '@': resolve(root, 'src') }
