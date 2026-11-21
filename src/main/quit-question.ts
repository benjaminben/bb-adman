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

export function quitQuestion(running: number): QuitQuestion | null {
  if (running <= 0) return null
  const going =
    running === 1
      ? '1 run is still going. Quitting stops it.'
      : `${running} runs are still going. Quitting stops them.`
  return {
    message: 'Quit Adman?',
    detail:
      `${going} Requests already sent to a paid provider may still be ` +
      'charged, and their results are lost.',
    buttons: ['Quit', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
  }
}
