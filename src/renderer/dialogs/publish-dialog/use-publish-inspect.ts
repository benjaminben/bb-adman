// The publish dialog's reads of publish.inspect (spec/phases/phase-09.md "Publishing"). On open
// it asks with no storage (the choices and the files only); choosing a storage asks again for
// what is published there. Only the latest answer counts, and `answeredFor` says which storage
// it describes, so a reply about one storage never stands for another. A failed read clears the
// last answer and gives its sentence; `again` repeats the read (the "Retry" button).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'
import type { PublishInspect } from '@/shared/schemas/queries/publish'

type Answer = { reply: PublishInspect; answeredFor: PublishStorageId | null }

export function usePublishInspect(projectId: string, campaignId: string) {
  const api = useApi()
  const [storage, setStorage] = useState<PublishStorageId | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [looking, setLooking] = useState(true)
  const [failure, setFailure] = useState<string | null>(null)
  const latest = useRef(0)

  // Sends the read; the answer is kept only if no later read was sent meanwhile.
  const ask = useCallback(
    (wanted: PublishStorageId | null) => {
      latest.current += 1
      const asked = latest.current
      void api
        .query('publish.inspect', { projectId, campaignId, storage: wanted })
        .then((reply) => {
          if (asked !== latest.current) return
          setLooking(false)
          setAnswer(reply.ok ? { reply: reply.data as PublishInspect, answeredFor: wanted } : null)
          setFailure(reply.ok ? null : reply.error.message)
        })
    },
    [api, projectId, campaignId],
  )

  // The first read, on open; `looking` starts true.
  useEffect(() => ask(null), [ask])

  function inspect(wanted: PublishStorageId | null) {
    setLooking(true)
    setFailure(null)
    ask(wanted)
  }

  function choose(id: PublishStorageId) {
    setStorage(id)
    inspect(id)
  }

  // What is published in the chosen storage, only once the latest answer is about it.
  const existing =
    !looking && storage !== null && answer?.answeredFor === storage ? answer.reply.existing : null

  return {
    storage,
    reply: answer?.reply ?? null,
    existing,
    looking,
    failure,
    choose,
    again: () => inspect(storage),
  }
}
