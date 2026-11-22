// manifest.json of a published campaign (spec/phases/phase-09.md "Publishing", A-220). Strict
// and bounded: the old manifest is read back from the user's storage, where anyone with
// access may have changed it, and a body that fails here counts as no manifest.
import { z } from 'zod'

// The file name, in the campaign folder. It never lists itself.
export const MANIFEST_NAME = 'manifest.json'

const MAX_FILES = 20_000
const id = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._+-]+$/)

// Relative to {campaignId}/, as the storage path rules want it.
export const ManifestFile = z
  .object({
    path: z.string().min(1).max(1024),
    bytes: z.number().int().min(0),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict()
export type ManifestFile = z.infer<typeof ManifestFile>

export const Manifest = z
  .object({
    format: z.literal(1),
    appVersion: id,
    projectId: id,
    campaignId: id,
    publishNumber: z.number().int().min(1),
    publishedAt: z.string().datetime(),
    files: z.array(ManifestFile).max(MAX_FILES),
  })
  .strict()
export type Manifest = z.infer<typeof Manifest>
