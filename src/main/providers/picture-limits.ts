// SPEC 6, 6.2 [1.20] F-01: the one owner of the size limits on what a provider sends back.
// They change only by a ruling.

// The whole answer, checked by the adapter's fetch wrapper.
export const MAX_PROVIDER_ANSWER_BYTES = 48 * 1024 * 1024

// One picture, checked by toPng before it is decoded.
export const MAX_PICTURE_BYTES = 32 * 1024 * 1024
export const MAX_PICTURE_SIDE = 8_192
export const MAX_PICTURE_PIXELS = 24_000_000
