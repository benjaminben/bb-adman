// Each function of the ComfyUI client called once, with values that pass the client's own
// checks, so a test can show a property holds for every call.
import type { ComfyClient } from '../../src/main/providers/comfyui/client'
import { uploadName } from '../../src/main/providers/comfyui/values'

const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const bytes = new Uint8Array([137, 80, 78, 71])

export function everyCall(client: ComfyClient): Array<[string, () => Promise<unknown>]> {
  client.adopt(id)
  return [
    ['systemStats', () => client.systemStats()],
    ['modelFiles', () => client.modelFiles('checkpoints')],
    ['nodeInfo', () => client.nodeInfo('KSampler')],
    ['uploadImage', () => client.uploadImage(uploadName(bytes), bytes)],
    ['submit', () => client.submit(id, {})],
    ['history', () => client.history(id)],
    ['jobState', () => client.jobState(id)],
    ['queueIds', () => client.queueIds()],
    ['removeFromQueue', () => client.removeFromQueue(id)],
    ['interrupt', () => client.interrupt(id)],
    ['viewFile', () => client.viewFile({ filename: 'a.png', subfolder: '', type: 'temp' }, 99)],
  ]
}
