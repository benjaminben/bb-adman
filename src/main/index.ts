// Start-up and the single-instance lock (SPEC 12). A double-clicked project file
// arrives as 'open-file' on macOS and as a command-line argument on Windows.
import { app, BrowserWindow, dialog, ipcMain, nativeImage, protocol, shell } from 'electron'
import { createCore, type Core } from './core'
import { createAppWindow } from './windows/app-window'
import { httpsOnly } from './windows/open-external'
import { devToolsEnabled } from './dev-tools-flag'
import { pngConverter } from './png-converter'
import { pictureFitter } from './picture-fitter'
import { registerAssetProtocol, registerAssetScheme } from './windows/asset-protocol'
import { checkChangedFiles, withChangeChecks } from './assets/change-trigger'
import { DIALOG_QUERIES, runDialogQuery } from './windows/dialogs'
import { registerIpc } from './ipc'
import { projectPathFromArgv } from './open-file'
import { safeStorageCrypto } from './secrets/safe-storage'
import { IPC_CHANNELS } from '@/shared/schemas/api'
import type { BusEvent } from './commands/bus'

if (process.env.ADMAN_USER_DATA_DIR) app.setPath('userData', process.env.ADMAN_USER_DATA_DIR)
registerAssetScheme(protocol)

let core: Core | null = null
const pendingOpens: string[] = []
const fromArgv = projectPathFromArgv(process.argv)
if (fromArgv) pendingOpens.push(fromArgv)

function send(event: BusEvent): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IPC_CHANNELS.event, event)
  // spec/scene.md, "The render service": it sees every event, for the eager thumbnails.
  core?.deps.render.onEvent(event)
}

function mainWindow(): BrowserWindow {
  const win = BrowserWindow.getAllWindows()[0] ?? createAppWindow()
  if (win.isMinimized()) win.restore()
  win.focus()
  return win
}

// SPEC 14, Slice A rulings point 2b: looks for linked files of one open project that
// changed outside the app.
function checkFiles(projectId: string): Promise<void> {
  const ready = core
  if (!ready) return Promise.resolve()
  const execute = ready.bus.execute
  return checkChangedFiles({ execute, emit: send, log: ready.log }, projectId)
}

async function openFromSystem(filePath: string): Promise<void> {
  if (!core) {
    pendingOpens.push(filePath)
    return
  }
  const win = mainWindow()
  const execute = withChangeChecks(core.bus.execute, checkFiles)
  const result = await execute('project.open', { filePath }, { actor: 'user' })
  if (!result.ok)
    await dialog.showMessageBox(win, { type: 'warning', message: result.error.message })
}

function start(): void {
  core = createCore({
    userDataDir: app.getPath('userData'),
    documentsDir: app.getPath('documents'),
    appVersion: app.getVersion(),
    crypto: safeStorageCrypto,
    env: process.env,
    emit: send,
    // The ask flow arrives with the MCP server (Phase 10). Until then nothing asks.
    askPermission: async () => false,
    openExternal: httpsOnly((url) => shell.openExternal(url)),
    devTools: devToolsEnabled(app.isPackaged, process.env),
    toPng: pngConverter((buffer) => nativeImage.createFromBuffer(buffer)),
    fitPicture: pictureFitter((buffer) => nativeImage.createFromBuffer(buffer)),
  })
  const ready = core
  ready.log.write({
    level: 'info',
    event: 'app',
    name: 'app.start',
    actor: 'system',
    ok: true,
    message: `Adman ${app.getVersion()} started`,
  })
  registerIpc(ipcMain, {
    execute: withChangeChecks(
      (name, input, opts) => ready.bus.execute(name, input, opts),
      checkFiles,
    ),
    query: (name, input, opts, event) =>
      (DIALOG_QUERIES as readonly string[]).includes(name)
        ? runDialogQuery(name, input, {
            window: BrowserWindow.fromWebContents(event.sender),
            log: ready.log,
          })
        : ready.query(name, input, opts),
    isInternal: (name) => ready.isInternal(name),
  })
  registerAssetProtocol(protocol, ready.projects)
  // Listens only while settings.mcp.enabled is on (SPEC 6.8); off on first run.
  void ready.mcp.startIfEnabled()
  createAppWindow()
  for (const filePath of pendingOpens.splice(0)) void openFromSystem(filePath)
}

app.on('browser-window-focus', () =>
  core?.projects.all().forEach((h) => void checkFiles(h.projectId)),
)

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  void openFromSystem(filePath)
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = projectPathFromArgv(argv)
    if (filePath) void openFromSystem(filePath)
    else mainWindow()
  })
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    // Quitting closes the MCP listener and drops its sessions (SPEC 5.3).
    void core?.mcp.stop()
    core?.closeAll()
  })
  void app.whenReady().then(start)
}
