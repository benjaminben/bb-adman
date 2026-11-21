// S2-5 [FR-267]: the ComfyUI server's own words for a failed run, asked for only when the user
// presses the button, once. The text is the server's data: it is set as text content in a
// <pre>, never as HTML, never as a link, never parsed (spec/security.md).
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { JobServerMessage } from '@/shared/schemas/queries/job'
import styles from './run-failure.module.css'

type Reply = { state: 'none' } | { state: 'loading' } | { state: 'shown'; text: string }

const NO_MESSAGE = 'The server sent no message for this run.'

export function useServerMessage(projectId: string, jobId: string) {
  const api = useApi()
  const [reply, setReply] = useState<Reply>({ state: 'none' })
  const [open, setOpen] = useState(false)

  async function toggle() {
    if (open) return setOpen(false)
    setOpen(true)
    if (reply.state !== 'none') return
    setReply({ state: 'loading' })
    const result = await api.query('job.getServerMessage', { projectId, jobId })
    const text = result.ok
      ? ((result.data as JobServerMessage | null)?.text ?? NO_MESSAGE)
      : result.error.message
    setReply({ state: 'shown', text })
  }

  return { open, reply, toggle }
}

export function ServerMessageButton(props: {
  open: boolean
  loading: boolean
  blockId: string
  onToggle: () => void
}) {
  const shown = props.open && !props.loading
  return (
    <button
      type="button"
      aria-expanded={shown}
      aria-controls={props.blockId}
      disabled={props.loading}
      onClick={props.onToggle}
    >
      {shown ? "Hide the server's message" : "Show the server's message"}
    </button>
  )
}

export function ServerMessageBlock(props: { id: string; reply: Reply }) {
  const { reply } = props
  return (
    <section id={props.id} className={styles.message} aria-labelledby={`${props.id}-heading`}>
      <h3 id={`${props.id}-heading`} className={styles.heading}>
        Message from the ComfyUI server
      </h3>
      {reply.state === 'shown' ? (
        <pre className={styles.text}>{reply.text}</pre>
      ) : (
        <p className={styles.text} role="status">
          {"Reading the server's message…"}
        </p>
      )}
    </section>
  )
}
