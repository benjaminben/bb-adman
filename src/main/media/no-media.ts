// The media tool when none is present: not available, and it writes nothing.
import type { MediaTool } from './types'

export const noMediaTool: MediaTool = {
  available: () => false,
  embedDetails: async () => null,
  ffmpeg: { run: async () => null },
}
