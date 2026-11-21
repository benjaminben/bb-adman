import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as clientModule from '../../../../../src/main/providers/comfyui/client'

const folder = join(__dirname, '../../../../../src/main/providers/comfyui')
// The client's source: the call list, how a request is sent, and the upload form.
const files = ['client.ts', 'request.ts', 'upload-form.ts']
const source = (file: string) => readFileSync(join(folder, file), 'utf8')

describe('calls the client cannot make [SPEC 6.10.2, REQ FR-271, FR-289, 14 CU-2]', () => {
  it.each(files)('%s holds no clear, /free, /userdata, /users or DELETE', (file) => {
    const text = source(file)
    for (const word of ['clear', '/free', '/userdata', '/users', 'DELETE']) {
      expect(text, `${file} holds ${word}`).not.toContain(word)
    }
  })

  it.each(files)('%s never reads a Location header', (file) => {
    expect(source(file).toLowerCase()).not.toContain('location')
  })

  it('exports createComfyClient and no general request function', () => {
    expect(Object.keys(clientModule)).toEqual(['createComfyClient'])
  })

  it('uses neither Electron net nor the global fetch', () => {
    for (const file of files) {
      expect(source(file)).not.toMatch(/from 'electron'|fetch\(/)
    }
  })
})
