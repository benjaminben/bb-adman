// The package dialog's steps (spec/screens-campaign.md, "Package project"; D-027): pick a
// folder, send project.package, and turn the reply into the next view. The chosen folder is
// kept for a second send and never drawn (A-48). While a send waits, the last view stays and
// `packaging` is true.
import { useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { PackageResult } from '@/shared/schemas/commands/asset'
import type { PickedPath } from '@/shared/schemas/queries/dialog'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { ErrorBody, Result } from '@/shared/schemas/result'

export type PackageView =
  | { kind: 'ready' }
  | { kind: 'done'; result: PackageResult }
  | { kind: 'missing'; assetIds: string[]; names: string[] }
  | { kind: 'refused'; message: string }

function missingIds(error: ErrorBody): string[] | null {
  const ids = error.details?.assetIds
  if (error.code !== 'MISSING_FILE' || !Array.isArray(ids)) return null
  return ids.filter((id): id is string => typeof id === 'string')
}

export function usePackage(projectId: string, onBusy: (busy: boolean) => void) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [view, setView] = useState<PackageView>({ kind: 'ready' })
  const [packaging, setPackaging] = useState(false)
  const folder = useRef<string | null>(null)

  async function namesOf(assetIds: string[]): Promise<string[]> {
    const listed = await api.query('asset.list', { projectId })
    const rows = listed.ok ? ((listed.data as AssetList | null) ?? []) : []
    const wanted = new Set(assetIds)
    return rows
      .filter((row) => wanted.has(row.id))
      .map((row) => row.displayName)
      .sort((a, b) => a.localeCompare(b))
  }

  async function viewOf(reply: Result<unknown>): Promise<PackageView> {
    if (reply.ok) return { kind: 'done', result: reply.data as PackageResult }
    const assetIds = missingIds(reply.error)
    if (assetIds === null) return { kind: 'refused', message: reply.error.message }
    return { kind: 'missing', assetIds, names: await namesOf(assetIds) }
  }

  async function send(skipMissing: boolean) {
    const targetDir = folder.current
    if (targetDir === null) return
    setPackaging(true)
    onBusy(true)
    const reply = await command('project.package', { projectId, targetDir, skipMissing })
    setView(await viewOf(reply))
    setPackaging(false)
    onBusy(false)
  }

  async function choose() {
    const title = 'Choose where to put the package'
    const picked = await api.query('dialog.pickFolder', { title })
    const path = picked.ok ? (picked.data as PickedPath | null)?.path : null
    if (path === null || path === undefined) return
    folder.current = path
    await send(false)
  }

  return { view, packaging, choose, send }
}
