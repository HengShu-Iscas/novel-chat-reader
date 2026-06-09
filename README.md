# NovelChat Reader

NovelChat Reader is a Chrome/Edge Manifest V3 extension that presents local TXT/EPUB reading sessions as AI-chat-style conversations.

It is an experimental, non-commercial open-source project. It is not affiliated with OpenAI, Google, DeepSeek, ByteDance, Doubao, or any other model provider.

## Features

- Open a full extension tab that looks like a normal AI chat page.
- Import local TXT and EPUB files.
- Show book titles as recent chat items, without covers.
- Use each book row's `...` menu as a chapter browser and chapter switcher.
- Show the current chapter and previous/next controls inside the input box.
- Split novel text into assistant messages with random short user interruptions.
- Optional API polish adapters for OpenAI, Gemini, DeepSeek, and Doubao/Volcengine Ark.
- API keys are session-only and are not persisted to IndexedDB or extension local storage.
- `Alt+B` boss key switches to the selected public chat site.

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
