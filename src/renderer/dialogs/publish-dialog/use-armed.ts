// The publish dialog's warnings step (lows C): "Publish anyway" is armed only 500 ms after the
// step opens, so the second click of a double click on "Publish" cannot land on it. `step` is
// the step's value (null while closed); a new value starts the wait again. The timer is
// cleared when the step closes or the dialog goes.
import { useEffect, useState } from 'react'

export const ARM_DELAY_MS = 500

export function useArmed(step: unknown): boolean {
  const [armed, setArmed] = useState<unknown>(null)
  useEffect(() => {
    if (step === null) return
    const timer = setTimeout(() => setArmed(step), ARM_DELAY_MS)
    return () => clearTimeout(timer)
  }, [step])
  return step !== null && armed === step
}
