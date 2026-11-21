// A Markdown or text brief (spec/screens-ai.md, "Reading a brief with AI"; FR-022, FR-171):
// the run dialog, then brief.extract, then the reading dialog until its job ends.
// Security (spec/security.md, "Paths in the renderer"): `start` takes the path the brief picker
// gave for the file the user chose, and that path, unchanged, is the only one brief.extract is
// sent; "Try again" sends it again. Nothing here builds or takes a path from anywhere else.
// NEEDS_KEY: the app store opens the key dialog and sends again once a key is saved; a
// NEEDS_KEY reply means the user cancelled it, so the empty form opens instead.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { BriefReadingDialog } from '@/renderer/dialogs/brief-reading-dialog'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import type { JobStarted } from '@/shared/schemas/commands/job'
import type { BriefParsed } from '@/shared/schemas/commands/brief'

type Step =
  | { kind: 'confirm'; filePath: string }
  | { kind: 'reading'; filePath: string; jobId: string; provider: string }

// `opened` gets the read brief, or null for the empty form.
export function useTextBrief(projectId: string, opened: (parsed: BriefParsed | null) => void) {
  const command = useApp((s) => s.command)
  const [step, setStep] = useState<Step | null>(null)

  async function confirm(filePath: string, provider: string) {
    const reply = await command('brief.extract', { projectId, filePath, provider })
    if (reply.ok) {
      const { jobId } = reply.data as JobStarted
      setStep({ kind: 'reading', filePath, jobId, provider })
    } else if (reply.error.code === 'NEEDS_KEY') {
      setStep(null)
      opened(null)
    }
    return reply
  }

  function finish(parsed: BriefParsed | null) {
    setStep(null)
    opened(parsed)
  }

  const dialogs = (
    <>
      {step?.kind === 'confirm' && (
        <RunDialog
          open
          projectId={projectId}
          job="text"
          title="Read the brief with AI"
          confirmLabel="Read brief"
          onConfirm={(provider) => confirm(step.filePath, provider)}
          onCancel={() => setStep(null)}
        />
      )}
      {step?.kind === 'reading' && (
        <BriefReadingDialog
          key={step.jobId}
          projectId={projectId}
          jobId={step.jobId}
          provider={step.provider}
          onRead={finish}
          onTryAgain={() => setStep({ kind: 'confirm', filePath: step.filePath })}
          onByHand={() => finish(null)}
          onClosed={() => setStep(null)}
        />
      )}
    </>
  )

  return { start: (filePath: string) => setStep({ kind: 'confirm', filePath }), dialogs }
}
