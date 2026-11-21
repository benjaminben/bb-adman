import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { projectPackage } from '../../../src/main/commands/project/package'
import { makeAssetBus, expectRefused } from './asset-bus'

let bus: ReturnType<typeof makeAssetBus>
let dir: string

beforeEach(() => {
  bus = makeAssetBus([projectPackage()])
  dir = path.dirname(bus.project.filePath)
  fs.mkdirSync(path.join(dir, 'P Assets', 'inner'), { recursive: true })
})
afterEach(() => bus.cleanup())

const pack = (targetDir: string) => bus.user('project.package', { targetDir })

function canLink(): boolean {
  try {
    fs.symlinkSync(path.join(dir, 'P Assets'), path.join(dir, 'probe'), 'dir')
    fs.unlinkSync(path.join(dir, 'probe'))
    return true
  } catch {
    return false
  }
}

describe('project.package step 1 [SPEC 14 1.30 U6, 3.9]', () => {
  it('refuses a target reached through a link into the assets folder', async (ctx) => {
    if (!canLink()) ctx.skip()
    fs.symlinkSync(path.join(dir, 'P Assets'), path.join(dir, 'via'), 'dir')
    const error = await expectRefused(
      bus,
      () => pack(path.join(dir, 'via', 'inner')),
      'RULE_VIOLATION',
    )
    expect(error.message).toBe("Choose a folder outside the project's assets folder.")
    expect(fs.readdirSync(path.join(dir, 'P Assets', 'inner'))).toEqual([])
  })

  it('refuses a folder named ..x inside the assets folder', async () => {
    fs.mkdirSync(path.join(dir, 'P Assets', '..x'))
    await expectRefused(bus, () => pack(path.join(dir, 'P Assets', '..x')), 'RULE_VIOLATION')
    expect(fs.readdirSync(path.join(dir, 'P Assets', '..x'))).toEqual([])
  })

  it('accepts a subfolder ..x of a normal folder', async () => {
    const target = path.join(dir, 'out', '..x')
    fs.mkdirSync(target, { recursive: true })
    expect(await pack(target)).toMatchObject({
      ok: true,
      data: { packagePath: path.join(target, 'P') },
    })
  })

  it('refuses a file named {Name} with RULE_VIOLATION and leaves it as it was', async () => {
    const target = path.join(dir, 'out')
    fs.mkdirSync(target)
    fs.writeFileSync(path.join(target, 'P'), 'keep me')
    const error = await expectRefused(bus, () => pack(target), 'RULE_VIOLATION')
    expect(error.message).toBe('Something named P is already there.')
    expect(fs.readFileSync(path.join(target, 'P'), 'utf8')).toBe('keep me')
    expect(fs.readdirSync(target)).toEqual(['P'])
  })
})
