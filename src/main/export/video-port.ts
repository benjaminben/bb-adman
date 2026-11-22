// One video ad's export (spec/phases/phase-08.md "Video"): FFmpeg in the ad's own work folder,
// the result written through the export target (P8-16, src/main/export/video/video-ad.ts).
import type { CoreDeps } from '@/main/core-deps'
import type { ExportVideo } from './types'
import { exportVideoAd } from './video/video-ad'

// The job context carries the same CoreDeps, so `_deps` is not read here.
export function createExportVideo(_deps: () => CoreDeps): ExportVideo {
  return {
    exportVariant: (jc, scene, plan, target, path) => exportVideoAd(jc, scene, plan, target, path),
  }
}
