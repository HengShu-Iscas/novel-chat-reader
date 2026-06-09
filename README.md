# NovelChat Reader

NovelChat Reader is a Chrome/Edge Manifest V3 extension and Windows browser-first desktop launcher that presents local TXT/EPUB reading sessions as AI-chat-style conversations.

It is an experimental, non-commercial open-source project. It is not affiliated with OpenAI, Google, DeepSeek, ByteDance, Doubao, or any other model provider.

## Features

- Open a full browser tab that looks like a normal AI chat page.
- Start with an empty local library; imported file names/book titles appear as recent chat rows in the sidebar.
- Import local TXT and EPUB files.
- Import from the visible upload button, the chat paperclip, drag-and-drop, the browser file picker, or Windows "Open with".
- Show book titles as recent chat items, without covers.
- Use each book row's `...` menu as a chapter browser and chapter switcher.
- Show the current chapter and previous/next controls inside the input box.
- Split novel text into assistant messages with random short user interruptions.
- Optional API polish adapters for OpenAI, Gemini, DeepSeek, and Doubao/Volcengine Ark.
- API keys are session-only and are not persisted to IndexedDB or extension local storage.
- `Alt+B` boss key switches to the selected public chat site. The companion extension can focus existing provider tabs; the Windows launcher falls back to opening the selected site in the default browser.

## Windows Desktop EXE

Regular users can run either generated file from `release/`:

- `NovelChat Reader-0.1.0-win-x64.exe`: Windows installer.
- `NovelChat Reader-0.1.0-win-x64-portable.exe`: portable app, no installation required.

The Windows app is a local launcher, not a separate reading window. Starting it creates a tray app, starts a local service on `http://127.0.0.1:17661/` when that port is available, and opens the reading UI in your default browser. If the preferred port is busy, nearby `176xx` ports are tried.

The installed browser mode persists books and progress through the local service under the current Windows user profile. This avoids losing the library when the default browser or local port changes. The standalone extension build still uses browser IndexedDB.

Desktop import paths:

- Click the top-right upload icon or the paperclip in the composer.
- Drag one or more `.txt` / `.epub` files onto the window.
- Use the browser file picker.
- Use Windows "Open with" for `.txt` / `.epub` files after installing the app; the launcher reads the file by path, queues it in the local service, and the browser page imports it into the sidebar.

To build the Windows desktop release:

```powershell
npm.cmd install
npm.cmd run dist:win
```

`dist:win` builds the web UI, bundles the Electron launcher scripts, and writes installer artifacts to `release/`. The packaging script sets Electron download mirrors by default for more reliable Windows builds; set `ELECTRON_MIRROR` or `ELECTRON_BUILDER_BINARIES_MIRROR` before running the command if you prefer a different mirror.

## Development

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
```

To preview during development:

```powershell
npm.cmd run dev
```

To preview the browser-first desktop launcher during development:

```powershell
npm.cmd run desktop:dev
```

To load the extension:

1. Run `npm.cmd run build`.
2. Open Chrome or Edge extension management.
3. Enable developer mode.
4. Load the generated `dist/` directory as an unpacked extension.

## Companion Extension

The extension is optional in installed browser mode. It improves the boss key and tab handling:

- Clicking the extension button opens or focuses the running local service page when it exists.
- Extension `Alt+B` reads local service settings first, then activates an already-open provider tab or navigates the current tab.
- Without the local service, the extension works as a standalone MV3 reading surface backed by IndexedDB.

## Permissions

- `storage`: saves local reader settings and state.
- `tabs`: implements the boss key by activating an existing target tab or navigating the current tab.
- `http://127.0.0.1/*` and `http://localhost/*`: lets the optional companion extension discover the local launcher service.

The extension does not inject scripts into model provider websites.

## Privacy

- Imported books are stored locally in IndexedDB for extension/static mode, or in the local service state for installed browser mode.
- Optional API polish is off by default.
- API keys are session-only and must be re-entered after the extension session ends.
- Do not import private or copyrighted files into a public repository.

## Brand And Takedown Notice

The visual skins are code-native approximations for personal, non-commercial use. No official screenshots or official logo assets are shipped in this repository.

If any rights holder believes a skin, name, or visual treatment is inappropriate, open an issue or contact the maintainer. The affected skin or repository will be removed or changed promptly.

## License

MIT. See [LICENSE](LICENSE).
