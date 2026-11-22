// START-1 (design/audit/spec-start.md "The crossfade", Order): a Fisher–Yates shuffle of all
// the pictures, and a reshuffle that never starts with the picture just shown.
import { describe, it, expect } from 'vitest'
import { shuffleOrder } from '@/renderer/screens/start/start-images/shuffle-order'

// A seeded random source (mulberry32), so every run of the test sees the same numbers.
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TEN = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

describe('shuffleOrder [START-1 Order]', () => {
  it('holds every picture once, so all ten show before any repeats', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const order = shuffleOrder(10, seeded(seed))
      expect([...order].sort((a, b) => a - b)).toEqual(TEN)
    }
  })

  it('gives the same order for the same random numbers, and different orders for others', () => {
    expect(shuffleOrder(10, seeded(7))).toEqual(shuffleOrder(10, seeded(7)))
    const orders = new Set(TEN.map((s) => shuffleOrder(10, seeded(s + 1)).join(',')))
    expect(orders.size).toBeGreaterThan(5)
  })

  it('swaps the first two when a reshuffle would start with the picture just shown', () => {
    // A source of all zeros makes Fisher–Yates move each last item to the front in turn.
    const first = shuffleOrder(10, () => 0)[0] as number
    const again = shuffleOrder(10, () => 0, first)
    expect(again[0]).not.toBe(first)
    expect(again[1]).toBe(first)
    expect([...again].sort((a, b) => a - b)).toEqual(TEN)
  })

  it('never shows the same picture twice in a row across many reshuffles', () => {
    const random = seeded(42)
    let order = shuffleOrder(10, random)
    const shown: number[] = [...order]
    for (let round = 0; round < 200; round++) {
      order = shuffleOrder(10, random, shown[shown.length - 1])
      shown.push(...order)
    }
    const repeats = shown.filter((n, i) => i > 0 && shown[i - 1] === n)
    expect(repeats).toEqual([])
  })

  it('handles one picture and none', () => {
    expect(shuffleOrder(1, Math.random, 0)).toEqual([0])
    expect(shuffleOrder(0, Math.random)).toEqual([])
  })
})
