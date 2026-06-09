# NovelChat Reader

NovelChat Reader is a Chrome/Edge Manifest V3 extension and Windows desktop app that presents local TXT/EPUB reading sessions as AI-chat-style conversations.

It is an experimental, non-commercial open-source project. It is not affiliated with OpenAI, Google, DeepSeek, ByteDance, Doubao, or any other model provider.

## Features

- Open a full extension tab that looks like a normal AI chat page.
- Import local TXT and EPUB files.
- Import from the visible upload button, the chat paperclip, drag-and-drop, or the desktop file picker.
- Show book titles as recent chat items, without covers.
- Use each book row's `...` menu as a chapter browser and chapter switcher.
- Show the current chapter and previous/next controls inside the input box.
- Split novel text into assistant messages with random short user interruptions.
- Optional API polish adapters for OpenAI, Gemini, DeepSeek, and Doubao/Volcengine Ark.
- API keys are session-only and are not persisted to IndexedDB or extension local storage.
- `Alt+B` boss key switches to the selected public chat site in the extension, and hides the desktop app while opening the selected public chat site in the default browser.

## Windows Desktop EXE

Regular users can run either generated file from `release/`:

- `NovelChat Reader-0.1.0-win-x64.exe`: Windows installer.
- `NovelChat Reader-0.1.0-win-x64-portable.exe`: portable app, no installation required.

The desktop app keeps the same local IndexedDB library model as the extension build. Imported books and progress stay local to the current Windows user profile.

Desktop import paths:

- Click the top-right upload icon or the paperclip in the composer.
- Drag one or more `.txt` / `.epub` files onto the window.
- Use Windows "Open with" for `.txt` / `.epub` files after installing the app.

To build the Windows desktop release:

```powershell
npm.cmd install
npm.cmd run dist:win
```

`dist:win` builds the web UI, bundles the Electron main/preload scripts, and writes installer artifacts to `release/`. The packaging script sets Electron download mirrors by default for more reliable Windows builds; set `ELECTRON_MIRROR` or `ELECTRON_BUILDER_BINARIES_MIRROR` before running the command if you prefer a different mirror.

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

To preview the desktop app during development:

```powershell
npm.cmd run desktop:dev
```

To load the extension:

1. Run `npm.cmd run build`.
2. Open Chrome or Edge extension management.
3. Enable developer mode.
4. Load the generated `dist/` directory as an unpacked extension.

## Permissions

- `storage`: saves local reader settings and state.
- `tabs`: implements the boss key by activating an existing target tab or navigating the current tab.

The extension does not request host permissions and does not inject scripts into model provider websites.

## Privacy

- Imported books are stored locally in IndexedDB.
- Optional API polish is off by default.
- API keys are session-only and must be re-entered after the extension session ends.
- Do not import private or copyrighted files into a public repository.

## Brand And Takedown Notice

The visual skins are code-native approximations for personal, non-commercial use. No official screenshots or official logo assets are shipped in this repository.

If any rights holder believes a skin, name, or visual treatment is inappropriate, open an issue or contact the maintainer. The affected skin or repository will be removed or changed promptly.

## License

MIT. See [LICENSE](LICENSE).
