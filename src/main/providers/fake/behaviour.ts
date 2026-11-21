// What the fake provider does on its next calls (SPEC 14 slice D). Tests set it; the fake is
// reachable only with ADMAN_FAKE_PROVIDERS=1 (SPEC 6). It makes no network call.
// onCancel (SPEC 6.11.2): 'stop' confirms, 'finish' finishes anyway, 'no_confirm' never says.
import type { ProviderErrorKind } from '../../../shared/schemas/queries/app'

export type FakeCancel = 'stop' | 'finish' | 'no_confirm'
export type FakeBehaviour = {
  fail: ProviderErrorKind | null
  waitMs: number
  onCancel: FakeCancel
}

const DEFAULT: FakeBehaviour = { fail: null, waitMs: 0, onCancel: 'stop' }
let current: FakeBehaviour = { ...DEFAULT }

export function setFakeBehaviour(change: Partial<FakeBehaviour>): void {
  current = { ...current, ...change }
}

export function resetFakeBehaviour(): void {
  current = { ...DEFAULT }
}

export function fakeBehaviour(): FakeBehaviour {
  return current
}

export const FAKE_FAILURE_DETAIL = 'Fake provider failure'
