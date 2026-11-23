// Start-up (SPEC 12). A double-clicked project file arrives as 'open-file' on macOS and as a
// command-line argument on Windows; single-instance.ts and open-from-system.ts handle both.
import path from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  protocol,
  session,
  shell,
} from 'electron'
import { createCore, type Core } from './core'
import { createAppWindow } from './windows/app-window'
import { httpsOnly } from './windows/open-external'
import { denyPermissions } from './windows/permissions'
import { setAppMenu } from './windows/app-menu'
import { applyAppIdentity } from './windows/app-identity'
import { APP_DISPLAY_NAME } from '@/shared/config/app-name'
import { devToolsEnabled } from './dev-tools-flag'
import { pngConverter } from './png-converter'
import { pictureFitter } from './picture-fitter'
import { createExportPictures } from './export/picture-encoder'
import { bitmapTurner } from './image-turner'
import { registerAssetProtocol, registerAssetScheme } from './windows/asset-protocol'
import { checkChangedFiles, withChangeChecks } from './assets/change-trigger'
import { DIALOG_QUERIES, runDialogQuery } from './windows/dialogs'
import { eventSender, fromMainFrame, registerIpc } from './ipc'
import { projectPathFromArgv } from './open-file'
import { systemOpener } from './open-from-system'
import { runSingleInstance } from './single-instance'
import { safeStorageCrypto } from './secrets/safe-storage'
import { createDraw } from './render/draw'
import { endRenderWindow } from './render/render-window'
import { endWebpDecoder, webpToPng } from './windows/webp-window'
import { afterQuitAnswer, quitQuestion } from './quit-question'
import { leftRunningList } from './jobs/left-running-list'
import { quietWindows } from './windows/quiet'
import { createMediaTool } from './media/embed-details'
import { cleanLeftovers } from './export/video/work-dir'
import { ffmpegPath } from './media/ffmpeg-path'
import { cancelDropboxSignIn } from './providers/dropbox/sign-in/session'
import { runBridge } from './bridge/run-bridge'
import { BRIDGE_FLAG, setBridgeLaunch } from './bridge/launch-command'
import { userDataOverride } from './user-data-override'
import { pixelReader } from './pixel-reader'

const userDataDir = userDataOverride(process.env, app.isPackaged)
if (userDataDir) app.setPath('userData', userDataDir)
// P10-9: started with --mcp-bridge, the process is the bridge and nothing else: no window, no
// lock, no listener (src/main/bridge/run-bridge.ts).
const bridgeMode = process.argv.includes(BRIDGE_FLAG)
// Test runs: no window on screen, and on macOS the app never becomes the front app.
const quiet = quietWindows(process.env, app.isPackaged)
if (quiet && process.platform === 'darwin') app.setActivationPolicy('accessory')
if (!bridgeMode) registerAssetScheme(protocol)

let core: Core | null = null

// The one app window. Every use goes through this reference, never through a list of all
// windows, which would include the hidden render window (spec/scene.md, "Life of the window").
let appWindow: BrowserWindow | null = null
const liveAppWindow = () => (appWindow && !appWindow.isDestroyed() ? appWindow : null)

function openAppWindow(): BrowserWindow {
  const win = createAppWindow(quiet)
  appWindow = win
  // Closing the window quits the app (window-all-closed), so it asks first too; otherwise a
  // "Cancel" would leave the app running with no window.
  win.on('close', (event) => {
    if (mustAsk()) {
      event.preventDefault()
      void askToQuit()
    }
  })
  // A page that did not load, or whose process ended, is written to the log: codes only, no
  // address or path.
  const fault = (name: string, message: string) =>
    core?.log.write({ level: 'error', event: 'app', name, actor: 'system', ok: false, message })
  win.webContents.on('did-fail-load', (_event, code, _text, _url, isMainFrame) => {
    if (isMainFrame) fault('app.pageLoadFailed', `The app page did not load (code ${code})`)
  })
  win.webContents.on('render-process-gone', (_event, details) =>
    fault('app.pageProcessGone', `The app page's process ended (${details.reason})`),
  )
  // The render window ends first, so window-all-closed still quits the app (OI-23).
  win.on('closed', () => {
    if (appWindow === win) appWindow = null
    endRenderWindow()
    endWebpDecoder()
  })
  return win
}

// Events go to the app window only (LP-1). spec/scene.md, "The render service": the render
// service sees every event, for the eager thumbnails.
const send = eventSender(
  () => liveAppWindow()?.webContents ?? null,
  (event) => core?.deps.render.onEvent(event),
)

// spec/screens-ai.md, "Attached jobs and the close warning": quitting with runs queued or
// running in any open project asks first; "Quit" closes every project through project.close
// with 'stop' (closeAllStopping), then quits. With nothing running, no box.
let quitConfirmed = false
let asking = false

function runningCount(): number {
  const ready = core
  if (!ready) return 0
  return ready.projects.all().reduce((n, h) => n + ready.deps.jobs.activeCount(h.projectId), 0)
}

function mustAsk(): boolean {
  return !quitConfirmed && quitQuestion(runningCount()) !== null
}

// P7-15 (A-174): the started paid video runs quitting leaves running, named in the question.
function leftRunning() {
  const ready = core
  if (!ready) return []
  return leftRunningList(ready.projects.all(), ready.deps.providers, ready.log)
}

async function askToQuit(): Promise<void> {
  const question = quitQuestion(runningCount(), leftRunning())
  if (asking || !question) return
  asking = true
  try {
    const options = { type: 'warning' as const, ...question }
    const win = liveAppWindow()
    const { response } = win
      ? await dialog.showMessageBox(win, options)
      : await dialog.showMessageBox(options)
    const next = afterQuitAnswer(response, liveAppWindow() !== null)
    if (next === 'showWindow') mainWindow()
    if (next !== 'quit') return
    await core?.closeAllStopping()
    quitConfirmed = true
    app.quit()
  } finally {
    asking = false
  }
}

function mainWindow(): BrowserWindow {
  const win = liveAppWindow() ?? openAppWindow()
  if (quiet) return win
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

const opener = systemOpener({
  execute: () => (core ? withChangeChecks(core.bus.execute, checkFiles) : null),
  mainWindow,
  emit: send,
  warn: (win, message) => dialog.showMessageBox(win, { type: 'warning', message }),
})
const fromArgv = projectPathFromArgv(process.argv)
if (fromArgv) opener.pending.push(fromArgv)

function start(): void {
  // Both windows use the default session, so this covers the render window too.
  denyPermissions(session.defaultSession)
  const turnImage = bitmapTurner((data, size) => nativeImage.createFromBitmap(data, size))
  // P7-4: the fixed FFmpeg path; making the tool sweeps left-over run folders once.
  const { resourcesPath, platform, arch } = process
  const binary = ffmpegPath({
    packaged: app.isPackaged,
    resourcesPath,
    appPath: app.getAppPath(),
    platform,
    arch,
  })
  const media = createMediaTool({
    binary,
    userData: app.getPath('userData'),
    log: { write: (e) => core?.log.write(e) },
  })
  void cleanLeftovers(app.getPath('userData'))
  core = createCore({
    userDataDir: app.getPath('userData'),
    comfyWorkflowsDir: path.join(app.getPath('userData'), 'comfy-workflows'),
    documentsDir: app.getPath('documents'),
    appVersion: app.getVersion(),
    crypto: safeStorageCrypto,
    env: process.env,
    emit: send,
    openExternal: httpsOnly((url) => shell.openExternal(url)),
    devTools: devToolsEnabled(app.isPackaged, process.env),
    toPng: pngConverter((buffer) => nativeImage.createFromBuffer(buffer), turnImage),
    fitPicture: pictureFitter((buffer) => nativeImage.createFromBuffer(buffer), turnImage),
    webpToPng,
    readPixels: pixelReader((buffer) => nativeImage.createFromBuffer(buffer)),
    drawScene: createDraw(),
    exportPictures: createExportPictures(
      (b) => nativeImage.createFromBuffer(b),
      (d, s) => nativeImage.createFromBitmap(d, s),
    ),
    media,
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
    mayCall: (event) => fromMainFrame(event, liveAppWindow()?.webContents ?? null),
  })
  registerAssetProtocol(protocol, ready.projects)
  // Listens only while settings.mcp.enabled is on (SPEC 6.8); off on first run.
  void ready.mcp.startIfEnabled()
  const execPath = process.execPath
  setBridgeLaunch(
    app.isPackaged
      ? { execPath, packaged: true }
      : { execPath, packaged: false, appPath: app.getAppPath() },
  )
  const devTools = devToolsEnabled(app.isPackaged, process.env)
  applyAppIdentity(app, process.platform, APP_DISPLAY_NAME)
  setAppMenu(Menu, { platform: process.platform, appName: APP_DISPLAY_NAME, devTools })
  openAppWindow()
  opener.openPending()
}

function quitHandlers(): void {
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', (event) => {
    if (mustAsk()) {
      event.preventDefault()
      void askToQuit()
      return
    }
    // Quitting closes the MCP listener and drops its sessions (SPEC 5.3).
    void core?.mcp.stop()
    cancelDropboxSignIn()
    endRenderWindow()
    endWebpDecoder()
    core?.closeAll()
  })
}

function startApp(): void {
  app.on('browser-window-focus', () =>
    core?.projects.all().forEach((h) => void checkFiles(h.projectId)),
  )
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    void opener.open(filePath)
  })
  runSingleInstance(app, {
    platform: process.platform,
    pendingPaths: () => opener.pending,
    open: (filePath) => void opener.open(filePath),
    wake: () => mainWindow(),
    onLocked: quitHandlers,
    start,
  })
}

if (bridgeMode) runBridge(app, safeStorageCrypto)
else startApp()
