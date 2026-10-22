# Game math

## Layout

5 reels × 3 rows. Each reel has a **reel strip** — a looped list of symbols
(see `packages/math/src/config.json`). A spin picks a random stop position on every strip and
shows 3 consecutive symbols from it.

## Symbols

| Id          | Tier |
| ----------- | ---- |
| `chip`      | low  |
| `eddie`     | low  |
| `implant`   | low  |
| `deck`      | low  |
| `pistol`    | high |
| `katana`    | high |
| `solo`      | high |
| `netrunner` | high |

No Wild or Scatter in the MVP.

## 243 ways

A symbol wins when it appears on adjacent reels starting from the leftmost reel, **in any
row**. Rows do not need to line up.

For each symbol:

1. Count its occurrences on reel 1, reel 2, … and stop at the first reel without it.
2. If it is on at least 3 consecutive reels, it wins.
3. `ways` = product of the counts on those reels.
4. `payout = paytable[symbol][reelCount] × ways × coinValue`.

There are 3⁵ = 243 possible left-to-right paths through a 5×3 grid, hence the name.

### Example

```
         Reel 1   Reel 2   Reel 3   Reel 4   Reel 5
Row 0   [katana]  chip    [katana]  eddie    solo
Row 1    chip    [katana]  eddie    implant  chip
Row 2    eddie   [katana]  solo     chip     eddie
```

Katana: reel 1 → 1, reel 2 → 2, reel 3 → 1, reel 4 → 0 (stop). `reelCount = 3`,
`ways = 1 × 2 × 1 = 2`. With a bet of €$ 1.00 (`coinValue = 4`):
`payout = 30 × 2 × 4 = 240` cents = €$ 2.40.

## Bets and coins

| Parameter           | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| `minBet` / `maxBet` | 50 / 50 000 cents (€$ 0.50 / €$ 500.00)               |
| `defaultBet`        | 100 (€$ 1.00)                                         |
| `betGranularity`    | 50 — every bet is a multiple of €$ 0.50               |
| `stepSizes`         | 50, 100, 200, 500, 1000, 2000, 5000 (€$ 0.50 … €$ 50) |
| `defaultStep`       | 100                                                   |
| Coins per bet       | 25 (the math's, server-internal)                      |

The bet parameters are the RGS's (`packages/rgs/src/config.json`); the coins are the math's
(`packages/math/src/config.json`). `coinValue = bet / 25`. Bets are multiples of 50, so
`coinValue` is an integer and every payout is an integer number of cents (ADR 007). The RGS
checks this at startup: `betGranularity` must be a multiple of the math's `betUnit` (25).

Changing the bet:

- The player picks a step from `stepSizes` (instead of choosing from a fixed list of bet
  levels); − / + subtract / add it, and the result is clamped to `[minBet, maxBet]`.
- The selected step is client-only state, remembered in `localStorage`.
- The server accepts any bet with `minBet ≤ bet ≤ maxBet` and `bet % betGranularity === 0`;
  any other bet is rejected with `INVALID_BET`.

## Paytable (coins, for a 25-coin bet)

| Symbol      | 3 reels | 4 reels | 5 reels |
| ----------- | ------- | ------- | ------- |
| `chip`      | 15      | 30      | 60      |
| `eddie`     | 15      | 30      | 60      |
| `implant`   | 15      | 40      | 100     |
| `deck`      | 20      | 50      | 125     |
| `pistol`    | 25      | 75      | 200     |
| `katana`    | 30      | 100     | 250     |
| `solo`      | 40      | 125     | 400     |
| `netrunner` | 60      | 250     | 750     |

## Return to player

RTP (the long-run share of bets returned as wins) is not verified in the MVP. Reel strips
(40 positions each) and the paytable were tuned by hand with a throwaway Monte Carlo run to
roughly 93 % RTP and 35 % hit frequency; these figures are indicative only
(see [limitations](limitations.md)).

## Debug presets

Presets (`packages/math/src/presets.json`) are ready-made grids used instead of a random spin
when selected in the debug drawer (ADR 011). They are evaluated with the normal rules.

| Id         | Outcome                                   | Win at €$ 1.00 bet   |
| ---------- | ----------------------------------------- | -------------------- |
| `noWin`    | No symbol reaches reel 3                  | 0                    |
| `smallWin` | `chip` on reels 1–3, 1 way                | €$ 0.60 (0.6×)       |
| `bigWin`   | `netrunner` on all 5 reels, 4 ways        | €$ 120.00 (120×)     |
| `maxWin`   | `netrunner` on all 15 positions, 243 ways | €$ 7 290.00 (7 290×) |

To add a preset, add an entry with `id`, `label` and a 5×3 `grid` to `presets.json`; the
debug drawer picks it up from `init.debug.presets`.
