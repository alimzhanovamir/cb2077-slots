# Documentation

Documentation for **cb2077-slots** — an HTML5 slot game (5×3, 243 ways) with a cyberpunk theme,
a Node.js backend emulator and an in-browser emulator for static hosting.

## Start here

| Document                                          | What it covers                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Architecture overview](architecture/overview.md) | System context, packages, key flows (spin, reconnect, tab takeover), platform state |
| [Architecture rules](architecture/rules.md)       | Mandatory rules for code: layer boundaries, types and validation, money, naming     |
| [ADR index](adr/README.md)                        | Architecture Decision Records — why things are the way they are                     |

## Reference

| Document                              | What it covers                                                          |
| ------------------------------------- | ----------------------------------------------------------------------- |
| [Protocol](protocol.md)               | Every client ↔ server message with JSON examples, error codes, timeouts |
| [Game math](math.md)                  | 243 ways rules, symbols, paytable, bets, reel strips, debug presets     |
| [Non-functional requirements](nfr.md) | Measurable quality requirements and how each is verified                |
| [Limitations](limitations.md)         | Known, accepted limitations of the MVP                                  |
| [Glossary](glossary.md)               | Slot and project terminology                                            |

## Working on the project

| Document                           | What it covers                                                   |
| ---------------------------------- | ---------------------------------------------------------------- |
| [Development](development.md)      | Setup, scripts, environment variables, git hooks, debug menu, CI |
| [Code style](code-style.md)        | Formatting, blank lines, types, class member order, imports      |
| [Testing](testing.md)              | Test strategy: unit, E2E, manual checklist                       |
| [Roadmap](roadmap.md)              | What comes after the MVP                                         |
| [Contributing](../CONTRIBUTING.md) | Branches, commit format, pull requests                           |
| [Changelog](../CHANGELOG.md)       | Release history                                                  |
