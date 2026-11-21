// The post title folder name (spec/export-and-checks.md "Output layout", spec/phases/phase-08.md
// "Output layout additions", A-192). The title is text a user typed, so it is made safe here
// before it reaches storage: the result always passes the storage path rules.
import { isReserved } from '@/shared/config/reserved-names'

const KEPT = /^[A-Za-z0-9+\-_ ]$/
const MAX = 80

const trimSpaces = (text: string) => text.replace(/^ +| +$/g, '')

export function postTitle(title: string): string {
  const kept = [...title].map((c) => (KEPT.test(c) ? c : '-')).join('')
  const name = trimSpaces(trimSpaces(kept).slice(0, MAX))
  if (name === '') return 'post'
  return isReserved(name) ? `post-${name}` : name
}
