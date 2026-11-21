// Slice WP: the page of the hidden WebP decoder window (src/main/windows/webp-window.ts).
// The main process calls admanDecodeWebp through executeJavaScript with the WebP as base64
// and gets PNG bytes back. Chromium decodes it; an animated WebP gives its first frame.
// Transparency is kept: the colours are not premultiplied or converted.
async function admanDecodeWebp(base64: string): Promise<Uint8Array> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  })
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No canvas')
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const png = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await png.arrayBuffer())
}

Object.assign(window, { admanDecodeWebp })
