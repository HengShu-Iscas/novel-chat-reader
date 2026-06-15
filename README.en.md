# NovelChat Reader

[中文](README.md)

NovelChat Reader is a local-first open-source reader that presents local TXT/EPUB novels as AI-chat-style conversations in a browser page. It ships as a Chrome/Edge Manifest V3 extension and as a Windows browser-first desktop launcher.

This is an independent, experimental, non-commercial project. It is not affiliated with OpenAI, Google, DeepSeek, ByteDance, Doubao, Volcengine, or any other model provider. The repository does not include official screenshots, official logo image assets, private books, or API keys.

## Features

- Opens a browser tab that resembles a normal AI chat surface.
- Starts with an empty local library; imported books appear as generated work/research/development topics.
- Real book titles are hidden by default and are only revealed while hovering the sidebar.
- Supports TXT and EPUB files.
- Supports imports from the top upload action, more menu, drag-and-drop, file picker, Windows "Open with", and a local library folder.
- In Windows installed browser mode, a configured folder can be scanned for top-level `.txt` / `.epub` files; adding or deleting files updates the sidebar.
- Each book row's `...` menu acts as the chapter browser and chapter switcher.
- Left/right arrow keys switch chapters, and sending from the fake composer advances to the next chapter.
- Chapter changes scroll the reading stream back to the top.
- Novel text is split on natural sentence boundaries; Chinese quoted dialogue prefers breaks after closing quotes.
- User interruptions come from a varied local template pool to avoid short, repetitive filler.
- Includes ChatGPT, Gemini, DeepSeek, and Doubao-style skins.
- Includes 10 built-in disguise topic themes; optional API-generated topics are left as an extension point.
- API keys remain session-only and are not written to IndexedDB, extension storage, or local service state.
- `Alt+B` opens the selected public AI site. The companion extension can focus an existing provider tab when available.

## Download And Run

Regular users should download release assets from GitHub Releases. The local `release/` directory is a build output and is not committed to git.

Windows builds produce two files:

- `NovelChat Reader-0.1.0-win-x64.exe`: installer.
- `NovelChat Reader-0.1.0-win-x64-portable.exe`: portable app, no installation required.

When the Windows app starts, it runs as a tray launcher, starts a local service, and opens the reading UI in your default browser. It prefers:

```text
http://127.0.0.1:17661/
```

If the preferred port is busy, nearby `176xx` ports are tried.

## Folder Library

Windows local-web / EXE mode supports a folder library for users who prefer managing books with the file explorer:

1. Open hidden settings and choose a library folder.
2. Suggested default: `%USERPROFILE%\Documents\NovelChat Books`.
3. Put `.txt` or `.epub` files in that folder.
4. Refresh or rescan; generated disguise topics will appear in the sidebar.
5. Deleted files disappear from the sidebar. If a file is later placed back at the same path, progress cache can be restored.

The first version scans only top-level files and does not recurse into subfolders. A broken book file is reported in hidden settings and does not block other books.

The browser extension cannot scan local folders directly, so it keeps manual import and IndexedDB storage.

## Manual Import

Supported import paths:

- Top upload icon.
- Import action in the more menu.
- Drag `.txt` / `.epub` files onto the page.
- Browser file picker.
- Windows "Open with" after installing the desktop app.

The paperclip inside the fake composer is visual only and does not import files.

## Chapters And Reading

- Open the chapter menu from the `...` button on each book row.
- Select any chapter, or use previous/next chapter actions.
- Left/right arrow keys switch chapters unless the composer is focused.
- Sending a message in the fake composer advances to the next chapter.
- Chapter changes scroll the stream to the top.

## Boss Key

- Press `Alt+B` while the page is focused to open the public AI site for the active skin.
- The Windows tray process also registers `Alt+B` as a global fallback.
- With the companion extension installed, an already-open target tab is focused first. Without it, the default browser opens the target site.

The desktop launcher does not control existing provider conversations. It only opens or focuses public sites.

## Extension Build

Load the Chrome/Edge extension:

1. Run `npm.cmd run build`.
2. Open the Chrome or Edge extensions page.
3. Enable developer mode.
4. Load an unpacked extension.
5. Select the generated `dist/` directory.

The extension can be used standalone or as an enhancement layer for Windows local-web mode.

Permissions:

- `storage`: saves local reader state and settings.
- `tabs`: activates or navigates tabs for the boss key.
- `http://127.0.0.1/*` and `http://localhost/*`: lets the companion extension discover the local launcher service.

The extension does not inject scripts into provider websites.

## Development

Install dependencies:

```powershell
npm.cmd install
```

Run tests and build:

```powershell
npm.cmd test
npm.cmd run build
```

Preview the web UI:

```powershell
npm.cmd run dev
```

Preview the browser-first desktop launcher:

```powershell
npm.cmd run desktop:dev
```

Build Electron main/preload scripts:

```powershell
npm.cmd run desktop:build
```

Build Windows installer and portable app:

```powershell
npm.cmd run dist:win
```

`dist:win` builds the web UI, bundles the Electron launcher scripts, and writes artifacts to `release/`. That directory is ignored by git and should not be committed. The packaging script sets Electron download mirrors by default; set `ELECTRON_MIRROR` or `ELECTRON_BUILDER_BINARIES_MIRROR` before running if you prefer another mirror.

Release checks:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run desktop:build
npm.cmd run scan:release
git diff --check
```

## Privacy

- Books stay local by default.
- Extension/static mode uses browser IndexedDB.
- Windows local-web mode uses local service state. Folder-library books are read by path and use stable path-based IDs for progress cache.
- Optional API polish is off by default.
- API keys are session-only and must be re-entered after the session ends.
- Do not commit private novels, screenshots, API keys, or release artifacts to a public repository.

## Brand And Takedown Notice

The four skins are code-native HTML/CSS approximations with generic icons for personal, non-commercial experimentation. This repository does not include official screenshots, official logo images, or provider-owned source files.

If a rights holder believes a skin, name, or visual treatment is inappropriate, please open an issue or contact the maintainer. The affected content will be removed or changed promptly.

## License

MIT. See [LICENSE](LICENSE).
