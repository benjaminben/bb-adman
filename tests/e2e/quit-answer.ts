// The "Quit Adman?" system box (P4-10) cannot be clicked, so Electron's dialog.showMessageBox
// is replaced in the main process, as screens.ts replaces the file dialog. A test that may end
// with a run still going answers "Quit" before app.close(), or the quit waits on the box.
// Not a test file itself.
import type { ElectronApplication } from '@playwright/test'

export type AskedBox = { message: string; detail: string; buttons: string[] }

// The next message boxes answer with `response`; each one asked is kept for the test.
export async function answerMessageBox(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, answer) => {
    const kept = globalThis as unknown as { asked?: unknown[] }
    kept.asked ??= []
    dialog.showMessageBox = (async (...args: unknown[]) => {
      kept.asked?.push(args.at(-1))
      return { response: answer, checkboxChecked: false }
    }) as unknown as typeof dialog.showMessageBox
  }, response)
}

export const askedBoxes = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { asked?: AskedBox[] }).asked ?? [])

// "Quit" is the first button of the quit question (src/main/quit-question.ts).
export const answerQuit = (app: ElectronApplication) => answerMessageBox(app, 0)
