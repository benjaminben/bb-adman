// P10-8: the agent activity line. An MCP client on this machine reads; the line shows in the
// shell's corner. 293 the line for a call with no project, 294 the line with the project's
// name. Read tools only, so nothing changes; nothing is paid and nothing leaves the machine.
// Made-up names only.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { toolSession } from '../integration/mcp/tool-client'
import { freePort } from '../integration/mcp/http-client'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('P10-8 shots', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { page } = session
  const port = await freePort()
  await command(page, 'settings.update', { mcp: { port } })
  await command(page, 'mcp.setEnabled', { enabled: true })
  const { token } = (await query(page, 'mcp.getConnectInfo', {})) as { token: string }
  const s = await toolSession(port, token)
  await screens.createProject(page, 'Harbour Lights')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string; name: string }[]
  }
  const projectId = state.openProjects.find((p) => p.name === 'Harbour Lights')!.projectId
  const line = page.getByRole('status').filter({ hasText: 'Agent working:' })

  expect((await s.call('list_projects', {})).isError).toBeFalsy()
  await expect(line).toHaveText('Agent working: list_projects', { timeout: 30_000 })
  await shot(page, '293-agent-activity-line')

  expect((await s.call('get_project', { project_id: projectId })).isError).toBeFalsy()
  await expect(line).toContainText('Agent working: get_project · Harbour Lights')
  await shot(page, '294-agent-activity-line-project')
})
