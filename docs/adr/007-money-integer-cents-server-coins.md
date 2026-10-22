# 007. Money in integer cents and server-side coins

- Status: Accepted
- Date: 2026-10-06

## Context

JavaScript numbers are IEEE-754 doubles: `0.1 + 0.2 !== 0.3`. Money stored as fractional
numbers accumulates rounding errors. In 243-ways games many wins are below the bet
(e.g. 0.4 × bet), so paytables expressed as bet fractions would require rounding.

## Decision

- **All amounts are integer cents** (branded `Cents`, validated as safe non-negative
  integers). `BigInt` is not used: 2^53 cents is far beyond any balance, and `BigInt` is not
  JSON-serialisable.
- **Every bet is a multiple of `betGranularity`** (50 cents); the server rejects any other bet
  with `INVALID_BET`. The bet limits and steps are the RGS's configuration, sent to the
  platform in `init.config` (see [game math](../math.md#bets-and-coins)).
- **Coins are a server-internal detail**: a bet is 25 coins, `coinValue = bet / 25`.
  The paytable is in integer coins, `win = coins × ways × coinValue`. Because every bet is a
  multiple of 50, `coinValue` is always an integer and wins never need rounding.
- The client never computes money; it only formats it for display in
  `apps/client/src/view/format/money.ts` (currency `€$`, 2 decimals); the platform hands the game
  a formatter, so the game formats no money itself (ADR 014).

## Considered options

- **Integer cents + coins** — exact arithmetic, one paytable for every bet. Chosen.
- **Floating-point amounts** — rounding errors.
- **Paytable as bet multipliers with rounding** — exact only with a rounding rule; cents are lost.

## Consequences

- No rounding anywhere; tests assert that every payout is an integer.
- Bet limits and steps are configuration; changing them needs no code change as long as
  every step stays a multiple of `betGranularity`.
