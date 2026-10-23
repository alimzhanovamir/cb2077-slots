# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-10-23

### Fixed

- A click or tap right after the game loaded could be ignored.

## [0.2.0] - 2026-10-23

### Added

- The version is shown in the bottom-left corner of the page, with a glitch effect.

## [0.1.0] - 2026-10-23

### Added

- 5×3, 243-ways slot with placeholder graphics: spin, bet − / + with a selectable step, Space to
  spin.
- Production-like split (ADR 014): platform (`apps/client`), self-contained PixiJS game
  (`packages/game`), RGS emulator (`packages/rgs`) with the game's math (`packages/math`); the
  game's data travels as an opaque payload.
- Two transports: Node.js WebSocket server and the in-page `demo` mode for GitHub Pages.
- Sessions, reconnect with round recovery, tab takeover.
- Platform system windows and auto-closing notices in its own cyberpunk style.
- Debug drawer: next outcome, next error, latency, dropped connection, balance and session, with a
  command terminal.
- Unit and E2E tests (4 browser projects × 2 modes), CI, GitHub Pages deploy, documentation.

[Unreleased]: https://github.com/alimzhanovamir/cb2077-slots/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/alimzhanovamir/cb2077-slots/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/alimzhanovamir/cb2077-slots/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/alimzhanovamir/cb2077-slots/releases/tag/v0.1.0
