// Settings: the ComfyUI server as one Section (SPEC 14 1.41 TP-3; 6.10.1, 6.10.10; SET-2). The
// field starts with the saved address, the one screen that may draw it. Save sends
// comfy.setAddress and contacts nothing; only Check asks the server. The state is a mark on the
// header; a failed check's sentence also stays on the page, as does the privacy paragraph.
import { useEffect, useState, type FormEvent } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import type { AdmanApi } from '@/shared/schemas/api'
import {
  CheckMark,
  ComfyCheckResult,
  failureSentence,
} from '@/renderer/screens/settings/comfy-check-result'
import { LicenceList } from '@/renderer/screens/settings/licence-list'
import { COMFY_PRIVACY } from '@/renderer/ui/comfy-privacy'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { OnServer } from './on-server'
import styles from './comfy-section.module.css'

async function comfyInfo(api: AdmanApi): Promise<ComfyInfo | null> {
  const result = await api.query('comfy.getInfo', {})
  return result.ok ? (result.data as ComfyInfo) : null
}

export function ComfySection(props: { fold?: 'open' | 'none' }) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [info, setInfo] = useState<ComfyInfo | null>(null)
  const [typed, setTyped] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ComfyCheck | null>(null)

  function showInfo(next: ComfyInfo) {
    setInfo(next)
    setTyped(next.address ?? '')
  }

  // Read once on open; later reads follow this section's own commands.
  useEffect(() => {
    let live = true
    void comfyInfo(api).then((next) => {
      if (!live || !next) return
      setInfo(next)
      setTyped(next.address ?? '')
    })
    return () => {
      live = false
    }
  }, [api])

  async function setAddress(address: string | null) {
    const reply = await command('comfy.setAddress', { address })
    if (!reply.ok) return setRefusal(reply.error.message)
    setRefusal(null)
    // An earlier result described the server at the old address.
    setResult(null)
    const next = await comfyInfo(api)
    if (next) showInfo(next)
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
  const shown = !checking && address !== null ? result : null
  const failure = shown === null || address === null ? null : failureSentence(shown, address)
  const describedBy = refusal === null ? undefined : 'comfy-address-refusal'

  return (
    <Section
      id="settings.comfy"
      title="ComfyUI server"
      level={3}
      fold={props.fold ?? 'open'}
      summary={
        <span role="status">
          <CheckMark address={address} checking={checking} check={shown} />
        </span>
      }
    >
      <form className={layout.field} onSubmit={save}>
        <label htmlFor="comfy-address">Server address</label>
        <div className={styles.line}>
          <input
            id="comfy-address"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-describedby={describedBy}
          />
          <button type="submit" className={layout.primary}>
            Save
          </button>
          {address !== null && (
            <button type="button" onClick={() => void setAddress(null)}>
              Remove
            </button>
          )}
          <button
            type="button"
            className={layout.secondary}
            disabled={address === null || checking}
            title={address === null ? 'Save an address first' : undefined}
            onClick={() => void check()}
          >
            Check
          </button>
        </div>
        {refusal !== null && (
          <NoticeLine kind="danger" id="comfy-address-refusal">
            {refusal}
          </NoticeLine>
        )}
        {failure !== null && <NoticeLine kind="danger">{failure}</NoticeLine>}
        <p className={`${layout.muted} ${styles.privacy}`}>{COMFY_PRIVACY}</p>
      </form>
      {shown !== null && <ComfyCheckResult check={shown} workflows={info?.workflows ?? []} />}
      <LicenceList />
      <OnServer sentences={info?.leavesOnServer ?? []} />
    </Section>
  )
}
