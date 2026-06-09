# Security Policy

## Sensitive Data

Do not commit:

- API keys or tokens
- Private keys or certificates
- Private TXT/EPUB books
- Official screenshots or provider-owned brand assets
- Private datasets or generated release artifacts

## API Keys

Optional model-provider API keys are held in session memory only. They are not written to IndexedDB, `chrome.storage.local`, or git-tracked files.

## Reporting

If you find a security issue, open a private communication channel with the maintainer or create a minimal public issue without secrets.
