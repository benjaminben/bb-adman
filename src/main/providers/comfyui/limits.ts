// SPEC 6.10.2 [REQ: FR-277] (security class): the one owner of the limits on what a ComfyUI
// server sends back, and of the client's time limits (provisional, set again after the trial).

// Any JSON answer.
export const MAX_COMFY_JSON_BYTES = 8 * 1024 * 1024

// A message from the server (an exception's type or text).
export const MAX_SERVER_TEXT_CHARS = 2_000

// A name, version or status from the server. Longer than the 128 characters a file name may
// have, so a cut name can never pass the file name check by being cut.
export const MAX_SERVER_NAME_CHARS = 256

// Connect and first byte: the fixed wait of FR-265.
export const CONNECT_MS = 10_000
// Each call in all, by its kind.
export const SHORT_CALL_MS = 15_000
export const UPLOAD_MS = 120_000
export const DOWNLOAD_MS = 300_000
