// spec/screens-variants.md, "Direction dialogs": the new direction's default name is
// "Direction {n}", the next free number. The count of directions plus one, skipping a number a
// direction already has (names compared trimmed and ignoring letter case, as the command does).
import { describe, expect, it } from 'vitest'
import { nextDirectionName } from '@/renderer/dialogs/direction-menu/next-name'

describe('nextDirectionName', () => {
  it.each([
    [['Direction 1'], 'Direction 2'],
    [['Main'], 'Direction 2'],
    [['Direction 1', 'Direction 2'], 'Direction 3'],
    [['Direction 1', 'Direction 3'], 'Direction 4'],
    [['Direction 2'], 'Direction 3'],
    [['Studio', ' direction 2 '], 'Direction 3'],
    [[], 'Direction 1'],
  ])('after %j gives %s', (names, expected) => {
    expect(nextDirectionName(names)).toBe(expected)
  })
})
