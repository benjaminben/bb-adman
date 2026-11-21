import { describe, it, expect } from 'vitest'
import {
  CONNECT_MS,
  DOWNLOAD_MS,
  MAX_COMFY_JSON_BYTES,
  MAX_SERVER_NAME_CHARS,
  MAX_SERVER_TEXT_CHARS,
  SHORT_CALL_MS,
  UPLOAD_MS,
} from '../../../../../src/main/providers/comfyui/limits'

describe('ComfyUI client limits, one owner [SPEC 6.10.2, 14 CU-2]', () => {
  it('holds the byte and text limits of the 6.10.2 table', () => {
    expect(MAX_COMFY_JSON_BYTES).toBe(8 * 1024 * 1024)
    expect(MAX_SERVER_TEXT_CHARS).toBe(2_000)
  })

  it('cuts a name from the server longer than the 128 characters a name may have', () => {
    expect(MAX_SERVER_NAME_CHARS).toBeGreaterThan(128)
  })

  it('holds the time limits of a single call', () => {
    expect(CONNECT_MS).toBe(10_000)
    expect(SHORT_CALL_MS).toBe(15_000)
    expect(UPLOAD_MS).toBe(120_000)
    expect(DOWNLOAD_MS).toBe(300_000)
  })
})
