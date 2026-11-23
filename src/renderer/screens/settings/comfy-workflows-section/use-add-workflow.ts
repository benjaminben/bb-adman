// "Add workflow…" (spec/comfyui-custom.md "Screens", D-104): the system picker for one .json
// file, then comfyWorkflow.addFromFile with the picked path, once. The path lives only in this
// function's own variable until the command is sent: it is never kept in state or drawn.
// A cancelled picker sends nothing. The result is one line: "Added {name}." or the refusal.
import { useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { PickedPaths } from '@/shared/schemas/queries/dialog'
import type { ComfyWorkflowAddFromFileReply } from '@/shared/schemas/commands/comfy-workflow'

export type AddLine = { kind: 'ok' | 'danger'; words: string }

export function useAddWorkflow(afterAdd: () => Promise<void>) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [line, setLine] = useState<AddLine | null>(null)
  const [busy, setBusy] = useState(false)
  // Set at the click, before React draws the disabled button, so a double click picks once.
  const adding = useRef(false)

  async function add() {
    if (adding.current) return
    adding.current = true
    setBusy(true)
    try {
      const picked = await api.query('dialog.pickFiles', { purpose: 'comfy-workflow' })
      const filePath = picked.ok ? (picked.data as PickedPaths | null)?.paths[0] : undefined
      if (filePath === undefined) return
      setLine(null)
      const reply = await command('comfyWorkflow.addFromFile', { filePath })
      if (!reply.ok) return setLine({ kind: 'danger', words: reply.error.message })
      const { name } = reply.data as ComfyWorkflowAddFromFileReply
      setLine({ kind: 'ok', words: `Added ${name}.` })
      await afterAdd()
    } finally {
      adding.current = false
      setBusy(false)
    }
  }

  return { add, line, busy }
}
