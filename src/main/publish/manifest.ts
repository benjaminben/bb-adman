// The old and the new manifest of a published campaign (spec/phases/phase-09.md "Publishing",
// A-220). Every path here is inside {campaignId}/. A manifest that is damaged, too large or of
// the wrong shape counts as none: it is logged by reason only, never with its content.
import type { ActivityLog } from '@/main/log/activity-log'
import type { StorageProvider } from '@/main/providers/types'
import { refusePath, storageFilePath } from '@/main/providers/storage-paths'
import { MANIFEST_NAME, Manifest } from '@/shared/publish/manifest'

// The most of an old manifest that is read (publish.inspect reads as much).
export const MANIFEST_MAX_BYTES = 8 * 1024 * 1024

export type PreviousPublish = { publishNumber: number; projectId: string; publishedAt: string }

// `{campaignId}/`, the one folder a publish lists, writes and deletes in. The campaign ID must
// be a single part that passes the storage path rules; anything else is "Storage path refused".
export function campaignPrefix(campaignId: string): string {
  if (campaignId === '' || campaignId.includes('/')) refusePath()
  return `${storageFilePath(campaignId)}/`
}

export function manifestPath(campaignId: string): string {
  return `${campaignPrefix(campaignId)}${MANIFEST_NAME}`
}

// The publish number this publish takes: the old one + 1, else 1.
export function nextPublishNumber(previous: PreviousPublish | null): number {
  return previous ? previous.publishNumber + 1 : 1
}

function parse(bytes: Uint8Array): Manifest | null {
  if (bytes.byteLength > MANIFEST_MAX_BYTES) return null
  try {
    const parsed = Manifest.safeParse(JSON.parse(new TextDecoder().decode(bytes)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

// The old manifest's number, project and time, or null when there is none or it is unusable.
// A storage failure is the caller's to handle.
export async function readPrevious(
  storage: StorageProvider,
  campaignId: string,
  opts: { log: ActivityLog },
): Promise<PreviousPublish | null> {
  const file = manifestPath(campaignId)
  if (!(await storage.exists(file))) return null
  const manifest = parse(await storage.read(file))
  if (!manifest) {
    opts.log.write({
      level: 'warn',
      event: 'job',
      name: 'publish',
      actor: 'system',
      ok: false,
      campaignId,
      message: 'The published manifest could not be read; it counts as none.',
      context: { reason: 'manifest_unreadable' },
    })
    return null
  }
  const { publishNumber, projectId, publishedAt } = manifest
  return { publishNumber, projectId, publishedAt }
}

// Writes {campaignId}/manifest.json. A manifest of another campaign, or one the schema
// refuses, is never written.
export async function writeManifest(
  storage: StorageProvider,
  campaignId: string,
  manifest: Manifest,
): Promise<void> {
  const file = manifestPath(campaignId)
  const checked = Manifest.parse(manifest)
  if (checked.campaignId !== campaignId) throw new Error('The manifest is of another campaign')
  const bytes = new TextEncoder().encode(JSON.stringify(checked))
  await storage.write(file, bytes, 'application/json')
}
