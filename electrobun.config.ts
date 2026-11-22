// The installed app on Electrobun (`node electrobun/pack.mjs`): see electrobun/main.ts. Electrobun 2.0.7, Bun main process, system webview.
// pack.mjs stages the Blank app's Program (the same files the Electron pack ships), Node and (macOS) Git under dist/electrobun-stage first.
import type { ElectrobunConfig } from 'electrobun'

export default {
  app: {
    name: 'ACRYL Blends Electrobun',
    identifier: 'io.github.acrylblends.electrobun-blank',
    version: process.env.ELECTROBUN_APP_VERSION ?? '0.2.0',
    description: 'The ACRYL Blends frame around an empty app, in an Electrobun window.',
  },
  runtime: { exitOnLastWindowClosed: true },
  build: {
    mainProcess: 'bun',
    bun: { entrypoint: 'electrobun/main.ts' },
    copy: {
      'dist/electrobun-stage/payload': 'payload',
      'dist/electrobun-stage/node': 'node',
      ...(process.platform === 'darwin' ? { 'dist/electrobun-stage/vcs': 'vcs' } : {}),
    },
    buildFolder: 'dist/electrobun-build',
    artifactFolder: 'dist/electrobun-artifacts',
    mac: { bundleCEF: false, icons: 'dist/electrobun-stage/icon.iconset' },
    linux: { bundleCEF: false, icon: 'dist/electrobun-stage/icon.png' },
    win: { bundleCEF: false, icon: 'dist/electrobun-stage/icon.png' },
  },
  release: { updateAuthority: 'none', generatePatch: false },
} satisfies ElectrobunConfig
