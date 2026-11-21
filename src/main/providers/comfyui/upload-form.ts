// SPEC 6.10.2: the form body of POST /upload/image. Fields `image`, `type=input` and
// `subfolder=adman`; `overwrite` is never sent. The name is the app's own (values.ts).
import { randomUUID } from 'node:crypto'

export function uploadForm(name: string, bytes: Uint8Array): { type: string; bytes: Uint8Array } {
  const boundary = `adman-${randomUUID()}`
  const part = (field: string, value: string) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"\r\n\r\n${value}\r\n`
  const head =
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${name}"\r\n` +
    'Content-Type: image/png\r\n\r\n'
  const tail = `\r\n${part('type', 'input')}${part('subfolder', 'adman')}--${boundary}--\r\n`
  return {
    type: `multipart/form-data; boundary=${boundary}`,
    bytes: Buffer.concat([Buffer.from(head), bytes, Buffer.from(tail)]),
  }
}
