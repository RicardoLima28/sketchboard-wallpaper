<p align="center"><img src="assets/icon.png" width="96" alt=""></p>

# Sketchboard Wallpaper — powered by Excalidraw

A drawing board as your Windows wallpaper: draw and write right on the desktop, no Wallpaper Engine required. The drawing editor is [Excalidraw](https://github.com/excalidraw/excalidraw).

> Independent, unofficial project with no affiliation to Excalidraw. "Excalidraw" is a trademark of its respective owners and is mentioned here only to indicate the technology used.

## How it works

A single window switches between two modes:

| Mode | Where it lives | Interaction |
| --- | --- | --- |
| Wallpaper (default) | Behind the desktop icons (the `WorkerW` layer) | Draw and type directly on the desktop, like Wallpaper Engine; desktop icons keep working |
| Fullscreen | On top of everything | For drawing while other windows are open |

- Mouse input over the desktop goes to the board; right-click still opens the Windows context menu, and dragging an icon still moves the icon.
- While the desktop has focus (click it or press Win+D), keyboard input goes to the board, including dead-key accents from layouts such as ABNT2.
- **Double-click the tray icon** (or use its menu) to open/close fullscreen mode.
- Your drawing is saved automatically (scene in `localStorage`, images in IndexedDB, under `%APPDATA%\sketchboard-wallpaper`).
- Tray menu (right-click the icon): fullscreen, language, start with Windows, quit.

### Languages

Right-click the tray icon > **Language** to switch between English, Português (Brasil) and Español. The choice applies to the tray menu and the whole drawing editor, and is saved in `settings.json`. On first run the app follows the Windows display language, falling back to English. Translations live in `src/main/i18n.js`.

Everything runs inside the app: global mouse and keyboard hooks (`src/main/input.js`), no scripts or local server.

## Install (users)

Download `Sketchboard Wallpaper Setup.exe` from Releases and run it. Installation is one click and does not require administrator rights; the app opens right away and starts with Windows from then on (you can turn this off from the tray icon). To uninstall: Settings > Apps.

> The installer is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Click **More info › Run anyway**.

## Development

Requires Node.js 18+ and Windows 10/11.

```sh
npm install
npm start      # run from source
npm run dist   # build the installer into out/
```

### Releasing

Installers are built by GitHub Actions (`.github/workflows/release.yml`):

1. Bump the version: `npm version 0.2.2 --no-git-tag-version`, then commit and push.
2. Tag it: `git tag v0.2.2 && git push origin v0.2.2`.
3. The workflow builds the installer and attaches it to a **draft** release. Edit the notes on GitHub and publish.

You can also build without releasing from the Actions tab (**Run workflow**); the installer is then available as an artifact of the run.

## Project structure

```
src/main/main.js          main process: modes, tray, settings
src/main/i18n.js          UI translations (tray menu and editor language)
src/main/desktop.js       Win32 calls (koffi) to place the window behind the icons
src/main/input.js         forwards desktop mouse/keyboard input to the board
src/main/preload.js       minimal bridge between the page and the main process
src/renderer/main.jsx     Excalidraw app + autosave
src/renderer/keyBridge.js delivers keystrokes to Excalidraw (accents, text editing)
build/installer.nsh       uninstaller removes the auto-start entry
build.mjs                 bundles the renderer into dist/ (esbuild) and copies fonts and licenses
```

## Known limitations

- Covers the primary monitor only.
- While the desktop has focus, keystrokes go to the board (F2/Delete on desktop icons don't work there).

## Privacy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

Your drawings and settings are stored only on your computer, under `%APPDATA%\sketchboard-wallpaper`. The app has no telemetry, analytics or accounts.

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

- Committers and reviewers: [RicardoLima28](https://github.com/RicardoLima28)
- Approvers: [RicardoLima28](https://github.com/RicardoLima28)

Only installers built by GitHub Actions from this repository's source are signed.

## License and credits

- This project: [MIT](LICENSE).
- [Excalidraw](https://github.com/excalidraw/excalidraw): MIT, © 2020 Excalidraw.
- Bundled fonts (Excalifont, Virgil, Nunito, Lilita One, Assistant, Cascadia Code, Liberation Sans, Xiaolai): SIL Open Font License 1.1; Comic Shanns: MIT.
- Other dependencies and full license texts: [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). The same file ships with the installer.
