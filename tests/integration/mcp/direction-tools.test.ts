// The direction tools (spec/mcp-and-agents.md, "Directions"; D-105): an agent reads a
// campaign's directions with get_campaign, adds one with create_direction and renames one with
// rename_direction without an ask, and deletes one with delete_direction, which asks the user
// as every delete does. Each reply holds IDs only.
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { replyJson, type ToolSession } from './tool-client'
import { askSetUp, type AskSetUp } from './ask-fixture'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

type Direction = { id: string; name: string; masterVariantId: string }
type Campaign = { directions: Direction[]; variants: Array<{ id: string; directionId: string }> }
type Made = { directionId: string; variantId: string }

const REFUSED = {
  code: 'AGENT_REFUSED',
  message: 'The user did not allow this action.',
  details: { reason: 'refused' },
}

async function campaign(a: AskSetUp, s: ToolSession): Promise<Campaign> {
  const reply = await s.call('get_campaign', { project_id: a.projectId, campaign_id: a.campaignId })
  return replyJson<Campaign>(reply)
}

async function create(a: AskSetUp, s: ToolSession, name: string, masterVariantId?: string) {
  const master = masterVariantId ?? (await campaign(a, s)).directions[0]!.masterVariantId
  return s.call('create_direction', {
    project_id: a.projectId,
    master_variant_id: master,
    name,
  })
}

const answer = (a: AskSetUp, requestId: string, allow: boolean) =>
  a.user('agent.answerPermission', { requestId, allow, rememberAuto: false })

describe('create_direction over MCP [D-105, FR-074]', () => {
  it('adds a direction from a master without an ask, and get_campaign lists it', async () => {
    x = await askSetUp()
    const s = await x.session()
    const before = await campaign(x, s)
    const reply = await create(x, s, 'Bold')
    expect(reply.isError).toBeFalsy()
    const made = replyJson<Made>(reply)
    expect(Object.keys(made).sort()).toEqual(['directionId', 'variantId'])
    expect(x.asked()).toEqual([])
    const after = await campaign(x, s)
    expect(after.directions).toHaveLength(before.directions.length + 1)
    expect(after.directions.find((d) => d.id === made.directionId)).toMatchObject({
      name: 'Bold',
      masterVariantId: made.variantId,
    })
    expect(after.variants.find((v) => v.id === made.variantId)).toMatchObject({
      directionId: made.directionId,
      createdBy: 'agent',
    })
  })

  it('refuses a name the campaign already has, and a variant that is not a master', async () => {
    x = await askSetUp()
    const s = await x.session()
    const first = (await campaign(x, s)).directions[0]!
    const taken = await create(x, s, first.name.toUpperCase())
    expect(taken.isError).toBe(true)
    expect(replyJson(taken)).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'direction_name_taken' },
    })
    const added = await s.call('add_variant', {
      project_id: x.projectId,
      direction_id: first.id,
      size_label: '9x16',
      language: 'en',
      format: 'image',
    })
    expect(added.isError).toBeFalsy()
    const notMaster = replyJson<{ variantId: string }>(added).variantId
    const reply = await create(x, s, 'Bold', notMaster)
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'not_a_master' },
    })
    expect((await campaign(x, s)).directions).toHaveLength(1)
  })
})

describe('rename_direction over MCP [D-105]', () => {
  it('renames without an ask, and the user can undo it', async () => {
    x = await askSetUp()
    const s = await x.session()
    const first = (await campaign(x, s)).directions[0]!
    const reply = await s.call('rename_direction', {
      project_id: x.projectId,
      direction_id: first.id,
      name: 'Studio',
    })
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual({ directionId: first.id })
    expect(x.asked()).toEqual([])
    expect((await campaign(x, s)).directions[0]!.name).toBe('Studio')
    data(
      await x.user('history.undo', { projectId: x.projectId, scope: `campaign:${x.campaignId}` }),
    )
    expect((await campaign(x, s)).directions[0]!.name).toBe(first.name)
  })
})

describe('delete_direction over MCP [D-105, D-099]', () => {
  const remove = (a: AskSetUp, s: ToolSession, directionId: string) =>
    s.call('delete_direction', { project_id: a.projectId, direction_id: directionId })

  it('asks with the direction line; allow deletes the direction and its variants', async () => {
    x = await askSetUp()
    const s = await x.session()
    const made = replyJson<Made>(await create(x, s, 'Bold'))
    const pending = remove(x, s, made.directionId)
    const asked = await x.nthAsk()
    expect(asked).toMatchObject({
      kind: 'delete',
      action: 'delete directions',
      target: 'Direction "Bold" (1 variant) in campaign "Summer Splash!" in "Spring Work"',
    })
    for (const id of [made.directionId, made.variantId, x.projectId]) {
      expect(JSON.stringify(asked)).not.toContain(id)
    }
    expect((await campaign(x, s)).directions).toHaveLength(2)
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual({ directionId: made.directionId })
    const after = await campaign(x, s)
    expect(after.directions.map((d) => d.id)).not.toContain(made.directionId)
    expect(after.variants.map((v) => v.id)).not.toContain(made.variantId)
  })

  it('refused by the user, deletes nothing and gives the refusal only', async () => {
    x = await askSetUp()
    const s = await x.session()
    const made = replyJson<Made>(await create(x, s, 'Bold'))
    const pending = remove(x, s, made.directionId)
    data(await answer(x, (await x.nthAsk()).requestId, false))
    const reply = await pending
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual(REFUSED)
    expect((await campaign(x, s)).directions).toHaveLength(2)
  })

  it('is not asked when the user ticked "Don\'t ask again for deletes"', async () => {
    x = await askSetUp()
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    const s = await x.session()
    const made = replyJson<Made>(await create(x, s, 'Bold'))
    expect(replyJson(await remove(x, s, made.directionId))).toEqual({
      directionId: made.directionId,
    })
    expect(x.asked()).toEqual([])
  })

  it("the campaign's last direction is refused by the command after the allow, and stays", async () => {
    x = await askSetUp()
    const s = await x.session()
    const only = (await campaign(x, s)).directions[0]!
    const pending = remove(x, s, only.id)
    data(await answer(x, (await x.nthAsk()).requestId, true))
    const reply = await pending
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'A campaign keeps at least one direction.',
    })
    expect((await campaign(x, s)).directions).toHaveLength(1)
  })
})

describe('what the direction tools say', () => {
  it('each says what it does; the delete says it cannot be undone and that the user is asked', async () => {
    x = await askSetUp()
    const s = await x.session()
    const tools = await s.list()
    const words = (name: string) => tools.find((t) => t.name === name)?.description
    expect(words('get_campaign')).toBe(
      'Read one campaign of an open project: its fields, rule set, directions (each with ' +
        'its ID, name and the ID of its master variant) and a summary of each variant with ' +
        'its badges.',
    )
    expect(words('create_direction')).toBe(
      'Add a creative direction to a campaign of an open project, as a copy of a master ' +
        'variant: give the masterVariantId of an existing direction, from get_campaign. The ' +
        "copy becomes the new direction's master. The name must differ from the campaign's " +
        'other directions. This cannot be undone; delete a direction that is not wanted. ' +
        'Gives the new direction ID and the ID of its master variant.',
    )
    expect(words('rename_direction')).toBe(
      "Rename a direction of an open project. The name must differ from the campaign's " +
        'other directions. The user can undo it. Gives the direction ID.',
    )
    expect(words('delete_direction')).toBe(
      'Delete a direction of an open project, with all its variants and their layers. A ' +
        'campaign keeps at least one direction. This cannot be undone. It also empties the ' +
        "undo list of its whole campaign, so the campaign's earlier changes can no longer be " +
        'undone either. The user is asked in the app, and this call waits up to two minutes ' +
        'for the answer. A refusal is final: do not ask again for the same direction unless ' +
        'the user tells you to.',
    )
  })
})
