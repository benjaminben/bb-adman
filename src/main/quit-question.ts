// spec/screens-ai.md, "Attached jobs and the close warning": the system message box shown
// before quitting while runs are queued or running in any open project. No box when none run.
// "Cancel" is the default, so Enter or Escape keeps the app open.
export type QuitQuestion = {
  message: string
  detail: string
  buttons: [string, string]
  defaultId: number
  cancelId: number
}

export const QUIT_BUTTON = 0

// P7-13 (A-174): started paid video runs that quitting leaves running, by provider label.
export type LeftRunning = { label: string; count: number }

function leftRunningLine({ label, count }: LeftRunning): string {
  return count === 1
    ? `${label} has started 1 video and will charge for it. It keeps running; open the project again to collect it.`
    : `${label} has started ${count} videos and will charge for them. They keep running; open the project again to collect them.`
}

export function quitQuestion(
  running: number,
  leftRunning: readonly LeftRunning[] = [],
): QuitQuestion | null {
  if (running <= 0) return null
  const going =
    running === 1
      ? '1 run is still going. Quitting stops it.'
      : `${running} runs are still going. Quitting stops them.`
  return {
    message: 'Quit Adman?',
    detail:
      `${going} Requests already sent to a paid provider may still be ` +
      'charged, and their results are lost.' +
      leftRunning
        .filter((l) => l.count > 0)
        .map((l) => ` ${leftRunningLine(l)}`)
        .join(''),
    buttons: ['Quit', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  }
}

// "Quit" quits. "Cancel" keeps the app; with no live app window it opens one, so a run left
// going is never left with no window to see it in.
export function afterQuitAnswer(
  response: number,
  windowLive: boolean,
): 'quit' | 'stay' | 'showWindow' {
  if (response === QUIT_BUTTON) return 'quit'
  return windowLive ? 'stay' : 'showWindow'
}
