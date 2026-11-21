// Test helper for slice A: an activity log that keeps its lines in memory. Not a test file.
import type { ActivityLog, LogInput } from '../../../src/main/log/activity-log'

export type TestLog = ActivityLog & { lines: LogInput[] }

export function testLog(): TestLog {
  const lines: LogInput[] = []
  return {
    lines,
    write: (entry) => {
      lines.push(entry)
    },
    prune: () => {},
  }
}
