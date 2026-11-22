/**
 * The installed ACRYL Blends Blank app on Electrobun instead of Electron. This file is Electrobun's main process (Bun); the window is the system
 * webview (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux).
 *
 * It does what @acryldev/desktop-shell's Electron main does for a packed product, with the same steps (electrobun/shell-core.mjs is a copy of them):
 * open the product's app in ~/.acryl (on the first start, make it from the bundled Blank app), start the frame host from the bundle (the Program),
 * and open one window on the address it prints. The frame host runs on the Node that ships inside the bundle (resources app/node), because the
 * framework loads plugins through node:module registerHooks, which Bun does not have. Closing the window stops the host.
 */
import Electrobun, { ApplicationMenu, BrowserWindow, Utils } from 'electrobun/main'
import { appendFileSync, existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { openProduct, startFrameHost } from './shell-core.mjs'

// Electrobun starts the main process in the bundle's bin folder (macOS: Contents/MacOS); its resources are ../Resources (electrobun/main Paths.ts).
const app = join(resolve('../Resources'), 'app')
const program = join(app, 'payload')
const node = join(app, 'node', process.platform === 'win32' ? 'node.exe' : 'node')
const vcs = join(app, 'vcs', 'bin')
const vcsBin = existsSync(vcs) ? vcs : undefined
// The bundled Git's builtin names travel as a list (electrobun/pack.mjs): make the links once, in the app Electrobun unpacked.
const linksFile = join(app, 'vcs', 'links.json')
if (existsSync(linksFile)) {
  const core = join(app, 'vcs', 'libexec', 'git-core')
  for (const { name, to } of JSON.parse(readFileSync(linksFile, 'utf8')) as { name: string; to: string }[])
    if (!existsSync(join(core, name))) {
      try {
        symlinkSync(to, join(core, name))
      } catch {}
    }
}
const title = 'ACRYL Blends (Electrobun)'

ApplicationMenu.setApplicationMenu([
  {
    submenu: [
      { role: 'about' },
      { type: 'divider' },
      { role: 'hide', accelerator: 'h' },
      { role: 'hideOthers' },
      { role: 'showAll' },
      { type: 'divider' },
      { role: 'quit', accelerator: 'q' },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'divider' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  },
  { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
])

const started = performance.now()
const { chosen, instance } = await openProduct({ program, vcsBin, version: '0.2.0' })
const logs = join(chosen.home, 'logs')
mkdirSync(logs, { recursive: true })
const logFile = join(logs, 'electrobun-host.log')
const host = startFrameHost({
  program,
  chosen,
  instance,
  runtime: node,
  vcsBin,
  write: (text: string) => {
    process.stdout.write(text)
    try {
      appendFileSync(logFile, text)
    } catch {}
  },
})

let stopped = false
const stopHost = async () => {
  if (stopped) return
  stopped = true
  await host.stop()
}
// The host is its own process group: quitting waits for it to end, then quits for real, so closing the window leaves no process behind.
Electrobun.events.on('before-quit', (event: { response?: { allow: boolean } }) => {
  if (stopped) return
  event.response = { allow: false }
  void stopHost().then(() => Utils.quit())
})
process.on('exit', () => {
  if (!stopped) void host.stop()
})
// A logout or `kill` ends the app with a signal, not through Quit: stop the host first there too.
for (const name of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const)
  process.on(name, () => {
    void stopHost().then(() => process.exit(0))
  })

let url: string
try {
  url = await host.ready
} catch (error) {
  console.error(`electrobun-blank: ${(error as Error).message}`)
  await stopHost()
  process.exit(1)
}
console.log(`electrobun-blank: frame host ready after ${(performance.now() - started).toFixed(0)} ms`)

const origin = new URL(url).origin
const window = new BrowserWindow({ title, url, frame: { width: 1280, height: 820, x: 120, y: 80 } })
// Links to other sites open in the person's browser, as the Electron shell does (navigation() in desktop-shell frame.ts).
window.webview.on('will-navigate', (event: { data?: { url?: string }; response?: { allow: boolean } }) => {
  const target = event.data?.url
  if (target === undefined) return
  try {
    const parsed = new URL(target)
    if (parsed.origin === origin || !/^(https?|mailto):$/u.test(parsed.protocol)) return
    event.response = { allow: false }
    Utils.openExternal(target)
  } catch {}
})
