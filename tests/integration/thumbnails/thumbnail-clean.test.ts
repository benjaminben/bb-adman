// spec/scene.md, "Thumbnails" (cleaning) and "The render service" (projectClosed); spec/security.md,
// thumbnail row: close deletes only old thumbnails directly in the project's folder.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeRenderFixture, PNG, V1, V2, type RenderFixture } from './render-fixture'

let r: RenderFixture
afterEach(() => r.f.cleanup())

async function closeProject(): Promise<void> {
  expect((await r.f.user('project.close', { projectId: r.projectId })).ok).toBe(true)
  await r.service.projectClosed(r.projectId)
}

function put(name: string): void {
  fs.writeFileSync(path.join(r.dir, name), PNG)
}

describe('clean-up on project close [spec/scene.md, Thumbnails]', () => {
  it('deletes old revs only; a link, a sub-folder and an unrelated file are left', async () => {
    r = await makeRenderFixture()
    r.setRev(V1, 3)
    r.setRev(V2, 1)
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    const outside = path.join(r.f.root, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'keep.png'), PNG)
    for (const name of [`${V1}-1.png`, `${V1}-2.png`, `${V2}-1.png`, `${V2}-0.png`]) put(name)
    put('aaaaaa-4.png') // a variant no longer in the project
    put(`${V1}-2.png.partial`)
    put('notes.txt')
    fs.symlinkSync(path.join(outside, 'keep.png'), path.join(r.dir, `${V1}-0.png`))
    fs.mkdirSync(path.join(r.dir, `${V2}-5.png`))
    fs.writeFileSync(path.join(r.dir, `${V2}-5.png`, `${V2}-0.png`), PNG)
    await closeProject()
    expect(fs.readdirSync(r.dir).sort()).toEqual(
      [`${V1}-0.png`, `${V1}-3.png`, `${V2}-1.png`, `${V2}-5.png`, 'notes.txt'].sort(),
    )
    expect(fs.readdirSync(path.join(r.dir, `${V2}-5.png`))).toEqual([`${V2}-0.png`])
    expect(fs.existsSync(path.join(outside, 'keep.png'))).toBe(true)
  })

  it('a linked project folder: writes nothing and deletes nothing', async () => {
    r = await makeRenderFixture()
    const outside = path.join(r.f.root, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, `${V1}-7.png`), PNG)
    fs.mkdirSync(path.dirname(r.dir), { recursive: true })
    fs.symlinkSync(outside, r.dir)
    expect(await r.query('thumbnail.get', { variantId: V1 })).toEqual({ state: 'pending', rev: 0 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    expect(await r.query('thumbnail.get', { variantId: V1 })).toEqual({ state: 'failed', rev: 0 })
    await closeProject()
    expect(fs.readdirSync(outside)).toEqual([`${V1}-7.png`])
    expect(r.f.readLogs()).not.toContain(outside)
  })

  it('drops waiting draws of the project and never throws', async () => {
    r = await makeRenderFixture()
    await r.query('thumbnail.get', { variantId: V1 })
    await r.query('thumbnail.get', { variantId: V2 })
    await closeProject()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(r.draw.mock.calls.length).toBeLessThanOrEqual(1)
    expect(fs.existsSync(r.dir) ? fs.readdirSync(r.dir) : []).toEqual([])
  })

  it('logs one warn line with no path when the clean-up fails, and still resolves', async () => {
    r = await makeRenderFixture()
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    r.setRev(V1, 1)
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(2))
    // The folder cannot be written, so deleting the old rev 0 fails.
    fs.chmodSync(r.dir, 0o500)
    try {
      await expect(closeProject()).resolves.toBeUndefined()
    } finally {
      fs.chmodSync(r.dir, 0o700)
    }
    expect(fs.readdirSync(r.dir).sort()).toEqual([`${V1}-0.png`, `${V1}-1.png`])
    const lines = r.f
      .readLogs()
      .split('\n')
      .filter((l) => l.includes('render.clean'))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('"level":"warn"')
    expect(lines[0]).not.toContain(r.f.root)
  })

  it('still resolves when the clean-up fails and the log cannot be written', async () => {
    r = await makeRenderFixture()
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(1))
    r.setRev(V1, 1)
    await r.query('thumbnail.get', { variantId: V1 })
    await vi.waitFor(() => expect(r.changed(V1)).toHaveLength(2))
    vi.spyOn(r.f.core.deps.log, 'write').mockImplementation(() => {
      throw new Error('disk full')
    })
    fs.chmodSync(r.dir, 0o500)
    try {
      await expect(r.service.projectClosed(r.projectId)).resolves.toBeUndefined()
    } finally {
      fs.chmodSync(r.dir, 0o700)
    }
  })
})
