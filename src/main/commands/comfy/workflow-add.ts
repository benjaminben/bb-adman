// comfyWorkflow.addFromFile and comfyWorkflow.add (spec/comfyui-custom.md "Commands, queries
// and events", D-104), security class. The person adds a file the system picker gave; an agent
// sends the file's text, so the app reads nothing from disk for an agent. Both run the file
// checks. No path, graph text or file text reaches a reply, a log line or an error.
import fs from 'node:fs'
import path from 'node:path'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { cleanName } from '@/main/mcp/clean-name'
import { checkWorkflowText, type CheckedWorkflow } from '@/main/providers/comfyui/custom/check-file'
import { takeWorkflowPath } from '@/main/providers/comfyui/custom/chosen-workflow-path'
import { serverChecks } from '@/main/providers/comfyui/needs'
import {
  MAX_CUSTOM_WORKFLOWS,
  MAX_WORKFLOW_BYTES,
  MAX_WORKFLOW_NAME,
} from '@/shared/comfy/custom-workflow'
import {
  customWorkflowRefusal,
  type CustomWorkflowRefusal,
} from '@/shared/providers/custom-workflow-messages'
import {
  comfyWorkflowAddFromFileInput,
  comfyWorkflowAddInput,
  type ComfyWorkflowAddFromFileReply,
  type ComfyWorkflowReply,
} from '@/shared/schemas/commands/comfy-workflow'
import { AppError } from '@/shared/schemas/result'
import { requireVideoGraph } from './workflow-update'

type Deps = Pick<CoreDeps, 'comfyWorkflows'>

export function refusal(r: CustomWorkflowRefusal): AppError {
  const body = customWorkflowRefusal(r)
  return new AppError(body.code, body.message, body.details)
}

function checked(text: string): CheckedWorkflow {
  const check = checkWorkflowText(text)
  if (!check.ok) throw new AppError(check.error.code, check.error.message, check.error.details)
  return check.data
}

// A regular file of at most MAX_WORKFLOW_BYTES; the size is read before any byte.
function readPicked(filePath: string): string {
  let text: string
  try {
    const stat = fs.lstatSync(filePath)
    if (!stat.isFile()) throw refusal({ reason: 'workflow_file_unreadable' })
    if (stat.size > MAX_WORKFLOW_BYTES) throw refusal({ reason: 'workflow_too_large' })
    text = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    if (e instanceof AppError) throw e
    // The system's error names the path, so it is dropped.
    throw refusal({ reason: 'workflow_file_unreadable' })
  }
  return text
}

// The file name without .json, cleaned by the shared name cleaner and cut to 60.
function nameOf(filePath: string): string {
  const base = path.basename(filePath).replace(/\.json$/i, '')
  const cut = [...cleanName(base)].slice(0, MAX_WORKFLOW_NAME).join('').trim()
  return cut === '' ? 'Workflow' : cut
}

export function comfyWorkflowAddFromFile(deps: Deps) {
  return defineCommand({
    name: 'comfyWorkflow.addFromFile',
    input: comfyWorkflowAddFromFileInput,
    changesAppState: true,
    run(_ctx, input) {
      // Rule 9: before any file-system call.
      if (!takeWorkflowPath(input.filePath)) throw refusal({ reason: 'workflow_not_picked' })
      const store = deps.comfyWorkflows
      if (store.list().length >= MAX_CUSTOM_WORKFLOWS) throw refusal({ reason: 'workflow_limit' })
      const graph = checked(readPicked(input.filePath))
      const name = store.freeName(nameOf(input.filePath))
      const entry = store.add({ checked: graph, name, addedBy: 'user' })
      serverChecks.forget()
      const data: ComfyWorkflowAddFromFileReply = { workflowId: entry.stored.id, name }
      return { data }
    },
  })
}

export function comfyWorkflowAdd(deps: Deps) {
  return defineCommand({
    name: 'comfyWorkflow.add',
    input: comfyWorkflowAddInput,
    changesAppState: true,
    run(ctx, input) {
      if (ctx.actor !== 'agent') throw refusal({ reason: 'workflow_add_in_settings' })
      const graph = checked(input.workflowJson)
      if (input.video) requireVideoGraph(graph)
      const entry = deps.comfyWorkflows.add({
        checked: graph,
        name: input.name,
        addedBy: 'agent',
        ...(input.video && { video: input.video }),
      })
      serverChecks.forget()
      const data: ComfyWorkflowReply = { workflowId: entry.stored.id }
      return { data }
    },
  })
}
