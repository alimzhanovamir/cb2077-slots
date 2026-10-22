# Non-functional requirements

Non-functional requirements describe measurable qualities of the system. Code rules live in
[architecture/rules.md](architecture/rules.md); processes live in
[CONTRIBUTING.md](../CONTRIBUTING.md).

| ID     | Category        | Requirement                                                                                                                      | Verification                                                                                   |
| ------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| NFR-01 | Performance     | Reels spin at 60 fps on a mid-range laptop                                                                                       | Manual, DevTools Performance panel                                                             |
| NFR-02 | Performance     | The server handles `spin` in < 50 ms, excluding debug latency                                                                    | Handling time is logged by the server                                                          |
| NFR-03 | Reliability     | The client reconnects within 10s after connectivity is restored                                                                  | E2E: debug "drop connection"                                                                   |
| NFR-04 | Reliability     | A page reload keeps the balance and the last round                                                                               | E2E                                                                                            |
| NFR-05 | Correctness     | Every monetary amount is an integer number of cents                                                                              | Unit tests of `evaluate` and bets                                                              |
| NFR-06 | Maintainability | Changing the platform requires no change in the game and vice versa; replacing placeholder graphics touches only `packages/game` | Package and layer boundaries enforced by ESLint, contracts checked by `tsc` (ADR 006, ADR 014) |
| NFR-07 | Compatibility   | Works in Chromium, Firefox and WebKit (Safari) on desktop and in mobile emulation (iPhone, Pixel)                                | Playwright E2E, all five projects                                                              |

## Notes

- **NFR-01**: headless browsers render WebGL in software, so frame rate is not measured in E2E.
- **NFR-07**: Playwright WebKit and device emulation are not real Safari or real devices.
  Before a release, check the game manually on a real iPhone.
