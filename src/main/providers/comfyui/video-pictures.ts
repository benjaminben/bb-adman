// SPEC 14 1.60 CU-6b N-6 and N-7 (security class): the pictures of a ComfyUI video run. The
// size a run is made at; the first frame's own stated size, which must be that size; and the
// upload of each picture. An upload sends only the bytes, under the app's own name; never a
// path, a display name, an asset ID or a file name. A cancel before submission uploads
// nothing more.
import { fitSize, type Size } from '../../../shared/comfy/fit-size'
import { pngPixelSize } from '../png-size'
import { ProviderCancelled, type ImageFile } from '../types'
import type { ComfyClient } from './client'
import { uploaded } from './image'
import type { WorkflowSpec } from './workflows/types'

// The size fillValuesFor sends for this workflow: fitted when it has a size slot.
export function runSizeOf(spec: WorkflowSpec, asked: Size): Size {
  return spec.slots.width && spec.slots.height ? fitSize(asked, spec.size) : asked
}

// N-7: a first frame whose PNG does not state the run size is a fault; nothing is uploaded.
export function checkFrameSize(image: ImageFile, size: Size): void {
  const stated = pngPixelSize(image.bytes)
  if (stated.width !== size.width || stated.height !== size.height) {
    throw new Error('The first frame is not the size of the run')
  }
}

export type UploadedPictures = { firstFrame?: string; references: string[] }

export async function uploadPictures(
  client: ComfyClient,
  pictures: { image: ImageFile | null; references: ImageFile[] },
  signal?: AbortSignal,
): Promise<UploadedPictures> {
  const stopIfAsked = () => {
    if (signal?.aborted) throw new ProviderCancelled()
  }
  const sent: UploadedPictures = { references: [] }
  if (pictures.image) {
    stopIfAsked()
    sent.firstFrame = await uploaded(client, pictures.image)
  }
  for (const file of pictures.references) {
    stopIfAsked()
    sent.references.push(await uploaded(client, file))
  }
  stopIfAsked()
  return sent
}
