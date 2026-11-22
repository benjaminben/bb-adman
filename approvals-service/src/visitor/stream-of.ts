// Hands checked bytes over in 1 MiB pieces, so no whole-reply size limit applies. Used by the
// picture route and the clip route.
const PIECE = 1024 * 1024

export function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let at = 0
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.byteLength) return controller.close()
      controller.enqueue(bytes.subarray(at, at + PIECE))
      at += PIECE
    },
  })
}
