# ACRYL Blends on Electrobun

The ACRYL Blends Blank app (the app `npx @acryldev/create-blends@latest` makes: the frame with sessions and versions on the left, the app in the
middle, chat and the agents on the right) as an installable desktop app on **Electrobun** instead of Electron. Same app, same Program, same data
folder (`~/.acryl/apps/<id>`); only the shell around it changes. It is a size and behaviour experiment: the Electron build stays ACRYL's default.

## Download

From the [Latest release](https://github.com/acrylblends/63-electrobun-blank/releases/latest):

| OS | Electrobun build | Electron build of the same app (for comparison) |
| --- | --- | --- |
| macOS (Apple silicon) | `ACRYL-Blends-Electrobun-mac-arm64.dmg` | `ACRYL-Blends-Electron-mac-arm64.dmg` |
| Windows | `ACRYL-Blends-Electrobun-win-x64.*` | `ACRYL-Blends-Electron-win-x64.exe` |
| Linux | `ACRYL-Blends-Electrobun-linux-x64.*` | `ACRYL-Blends-Electron-linux-x64.deb` |

The builds are not signed. macOS: right-click the app and choose Open. Windows: if SmartScreen asks, click More info and then Run anyway. The
first start unpacks the app (about 15 s on macOS, a small "Setup" window says when it is done; close it).

## Sizes

| OS | Download: Electron | Download: Electrobun | Installed: Electron | Installed: Electrobun | Electrobun parts: shell + Node + Git + app |
| --- | ---: | ---: | ---: | ---: | --- |
| mac arm64 | 204.1 | 111.7 (-45%) | 546.6 | 473.3 (-13%) | 111.9 + 121.3 + 35.9 + 204.1 |

Electron's parts on the same rows: shell mac arm64 306.6; the app (payload) is the same bytes on both sides.

MB = 1,000,000 bytes, apparent size (the sum of file sizes), measured by `electrobun/pack.mjs` on the release runners from the same Program
(`sizes-<os>-<arch>.json` in the release). "Installed" is the app after its first start.

Why the installed size drops less than the download: Electron doubles as the Node that runs the frame host, while the Electrobun build ships Node
(about 121 MB on macOS) beside Electrobun's Bun, because the framework loads plugins through `node:module` `registerHooks`, which Bun does not
have yet. The download drops more because Electrobun ships the app zstd-compressed and unpacks it on the first start.

## How it works

- `electrobun/main.ts` is Electrobun's main process (Bun). It does for the packed product what `@acryldev/desktop-shell`'s Electron main does,
  with the same steps (`electrobun/shell-core.mjs` is a copy of them): open the product's app in `~/.acryl` (on the first start, make it from
  the bundled Blank app), start the frame host from the bundle on the bundled Node, open one window (the system webview: WKWebView on macOS,
  WebView2 on Windows, WebKitGTK on Linux) on the address the host prints, and stop the host when the window closes.
- `electrobun/pack.mjs` packs both: `npx @acryldev/blends pack` (the official Electron product), then an Electrobun bundle from the same files
  (`resources/app` of the Electron build), the Node that runs the script, and on macOS the bundled Git. `.github/workflows/release.yml` runs it
  on every OS; a tag `v<version>` publishes the release.

```sh
npm run pack:electrobun    # this machine's OS and CPU; writes dist/release
```

Hutch (Electrobun's build tool, downloaded on first use into `~/.hutch`) may add a PATH line to your shell profile. Run it in CI or check
`~/.zshrc` afterwards.

## Not the same as the Electron build yet

- No updater (Electrobun has its own update channel; the ACRYL GitHub-release updater is Electron-only), no door window calls (`acryl window
  ...`), no Settings > App pages that need the Electron preload, no host restart supervisor.
- The window's process is named `bun` in macOS's process list; the Dock shows the app's name and icon.
- No Intel-Mac guarantee: Electrobun lists Apple silicon, Windows x64 and Linux x64/arm64 as its platforms.

## The app itself

A Cordis app on Node, scaffolded by `acrylblends init`. TypeScript, run by Node with no build step. Every part is a
Cordis plugin.

```sh
npm install
npm run dev        # prints its URL; data lives in ~/.acryl/apps/<id>/data/
npm test
npm run check      # type-check
```

- `src/main.ts` chooses where the app lives (the `@acryldev/instance` package) and starts it.
- `blend.yaml` is the app as data: which plugins it mounts, in what order, with what config and parameters. Switch
  one off with `disabled: true`. `npm run lock` writes `blend.lock.json`: the manifest's digest and a digest of
  every plugin folder, so a diff of the lock shows what changed.
- `src/app.ts` holds the registry of plugins the code provides, and mounts the manifest's rows.
- `src/routes.ts` is your own plugin: it builds an `App` (`import { App } from './plugins/router/src/index.ts'`) and mounts it with `ctx.router.route(prefix, app)`. Routes added to the app after it is mounted are not served. A page mounted at `/x` answers `/x`, not `/x/` (trailing slashes are strict). The router API is documented at https://acrylblends.github.io/docs/framework/the-acryl-framework and in `docs/framework` of the acrylblends repository.
- `plugins/` holds the plugins copied from the ACRYLBLENDS library. They are yours now; edit them freely.
  Add more with `acrylblends add <plugin>`.

`npm run save -- "message"` commits the app with git (and pushes when it has a remote). It refuses a file that looks like
it holds a secret, and refuses to push a private app (anything but `visibility: public` in `blend.yaml`) to a public
remote.

Set `ACRYLBLENDS_HOME` to keep data elsewhere, and `ACRYLBLENDS_PORT` to choose the first port tried.
