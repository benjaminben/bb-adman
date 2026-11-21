import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { answerAssetRequest } from '@/main/assets/asset-url'
import { createProjectRegistry, type ProjectRegistry } from '@/main/db/project-registry'
import { closeProjectFile, createProjectFile, type ProjectHandle } from '@/main/db/project-file'
import { insertTestAsset } from './asset-rows'

let root: string
let project: ProjectHandle
let projects: ProjectRegistry
const ID = '01JD0000000000000000000001'

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-mime-'))
  project = createProjectFile({
    filePath: path.join(root, 'P.adman'),
    name: 'P',
    appVersion: '0.1.0',
    now: 'x',
  })
  projects = createProjectRegistry()
  projects.add(project)
  fs.writeFileSync(path.join(root, 'a.png'), '<script>x</script>')
})
afterEach(() => {
  closeProjectFile(project)
  fs.rmSync(root, { recursive: true, force: true })
})

const answerFor = (kind: 'image' | 'video' | 'font', mime: string) => {
  insertTestAsset(project.db, { id: ID, relPath: 'a.png', absPath: '/none/a.png', kind, mime })
  return answerAssetRequest(
    { method: 'GET', url: `adman-asset://${project.projectId}/${ID}` },
    projects,
  )
}

describe('the adman-asset:// answer sends only a known type [SPEC 14 1.30 U5]', () => {
  it('gives 404 for an image row whose mime is text/html', async () => {
    const res = await answerFor('image', 'text/html')
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('')
    expect(res.headers.get('content-type')).toBe(null)
  })

  it('gives 404 for a video row whose mime belongs to another kind', async () => {
    expect((await answerFor('video', 'image/png')).status).toBe(404)
  })

  it('sends a font row with a font type file-types.ts lists', async () => {
    const res = await answerFor('font', 'font/woff2')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('font/woff2')
  })
})
