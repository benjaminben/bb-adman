// deps.publish (spec/phases/phase-09.md "The export interface"). core.ts builds it once. Each
// port comes from its own file, so the slices that fill them never edit this one.
import { exportForPublish, warningsForPublish } from './export-adapter'
import type { PublishPorts } from './ports'
import { storageFor } from './storage-for'

export function createPublishDeps(): PublishPorts {
  return { exportForPublish, warningsForPublish, storageFor }
}
