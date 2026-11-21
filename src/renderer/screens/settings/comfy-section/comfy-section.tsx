// Settings: the ComfyUI server (SPEC 14 1.41 TP-3; 6.10.1, 6.10.10). The saved address is
// shown in full here, the one screen that may draw it. Save sends comfy.setAddress and
// contacts nothing; only Check asks the server.
import { useEffect, useState, type FormEvent } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import type { AdmanApi } from '@/shared/schemas/api'
import { ComfyCheckResult } from '@/renderer/screens/settings/comfy-check-result'
import { LicenceList } from '@/renderer/screens/settings/licence-list'
import { COMFY_PRIVACY } from '@/renderer/ui/comfy-privacy'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'

async function comfyInfo(api: AdmanApi): Promise<ComfyInfo | null> {
  const result = await api.query('comfy.getInfo', {})
  return result.ok ? (result.data as ComfyInfo) : null
}

export function ComfySection() {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [info, setInfo] = useState<ComfyInfo | null>(null)
  const [typed, setTyped] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ComfyCheck | null>(null)

  async function readInfo() {
    const next = await comfyInfo(api)
    if (next) setInfo(next)
  }

  // Read once on open; later reads follow this section's own commands.
  useEffect(() => {
    let live = true
    void comfyInfo(api).then((next) => {
      if (live && next) setInfo(next)
    })
    return () => {
      live = false
    }
  }, [api])

  async function setAddress(address: string | null) {
    const result = await command('comfy.setAddress', { address })
    if (!result.ok) return setRefusal(result.error.message)
    setRefusal(null)
    setTyped('')
    // An earlier result described the server at the old address.
    setResult(null)
    await readInfo()
  }

  async function check() {
    setChecking(true)
    const reply = await command('comfy.check', {})
    setResult(reply.ok ? (reply.data as ComfyCheck) : null)
    setChecking(false)
  }

  function save(event: FormEvent) {
    event.preventDefault()
    void setAddress(typed)
  }

  const address = info?.address ?? null

  return (
    <section className={layout.card} aria-labelledby="comfy-title">
      <h2 id="comfy-title">ComfyUI server</h2>
      <p className={layout.label}>Saved address</p>
      {address === null ? (
        <p className={layout.muted}>No address saved.</p>
      ) : (
        <p className={layout.path}>{address}</p>
      )}
      <form className={layout.field} onSubmit={save}>
        <label htmlFor="comfy-address">Server address</label>
        <div className={layout.row}>
          <input
            id="comfy-address"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-describedby={refusal === null ? undefined : 'comfy-address-refusal'}
          />
          <button type="submit" className={layout.primary}>
            Save
          </button>
          {address !== null && (
            <button type="button" onClick={() => void setAddress(null)}>
              Remove
            </button>
          )}
        </div>
        {refusal !== null && (
          <NoticeLine kind="danger" id="comfy-address-refusal">
            {refusal}
          </NoticeLine>
        )}
        <p className={layout.muted}>{COMFY_PRIVACY}</p>
      </form>
      <div className={layout.row}>
        <button type="button" disabled={address === null || checking} onClick={() => void check()}>
          Check
        </button>
      </div>
      {checking && <p role="status">Checking…</p>}
      {!checking && result !== null && address !== null && (
        <ComfyCheckResult check={result} address={address} workflows={info?.workflows ?? []} />
      )}
      <LicenceList />
      {(info?.leavesOnServer.length ?? 0) > 0 && (
        <>
          <h3>What Adman leaves on the server</h3>
          <ul>
            {info?.leavesOnServer.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
