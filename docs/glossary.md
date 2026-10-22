# Glossary

| Term              | Meaning                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **243 ways**      | Win mechanic: a symbol pays when it appears on adjacent reels from the left, in any row. 3⁵ = 243 paths on a 5×3 grid. |
| **Autoplay**      | The game spins automatically until a stop condition is met. Not in the first release (roadmap).                        |
| **Bet**           | Amount staked on one spin, in cents. Changed by − / + in steps.                                                        |
| **Bet step**      | Amount added or subtracted by the − / + buttons; chosen by the player.                                                 |
| **Coin**          | Server-internal unit: a bet is 25 coins; the paytable is in coins.                                                     |
| **Coin value**    | `bet / 25`, in cents.                                                                                                  |
| **Connection**    | A temporary channel (WebSocket or in-page) between the platform and the RGS.                                           |
| **Debug drawer**  | Slide-out developer panel that forces outcomes, errors, latency and balance.                                           |
| **Envelope**      | The generic part of a message (bet, win, balance, ids) that the platform and the RGS read.                             |
| **Game**          | The presentation (`packages/game`): its canvas, reels, bottom panel and the round presentation. Knows no platform.     |
| **Game math**     | The game's rules (`packages/math`): reel strips, paytable, 243 ways, presets. Plugged into the RGS as a `GameMath`.    |
| **Game payload**  | The game's part of a message (`Round.outcome`, `init.game`): opaque (`unknown`) to the platform and the RGS.           |
| **Grid**          | The 5×3 symbols visible after a spin, `grid[reel][row]`.                                                               |
| **Hit frequency** | Share of spins with any win. Not measured in the MVP.                                                                  |
| **Paytable**      | Payout in coins per symbol for 3, 4 and 5 reels.                                                                       |
| **Platform**      | The client that runs the game (`apps/client`): connection, round lifecycle, money, system windows. The "wrapper".      |
| **Preset**        | A ready-made grid used for the next spin via the debug drawer.                                                         |
| **Reel**          | One vertical column of the grid.                                                                                       |
| **Reel strip**    | The looped list of symbols a reel is drawn from.                                                                       |
| **RGS**           | Remote Game Server: sessions, rounds, balance, last-round recovery (`packages/rgs`), runs in Node.js and the browser.  |
| **Round**         | One played spin: the envelope (bet, total win, resulting balance) and the game payload (grid, wins).                   |
| **RTP**           | Return to player: long-run share of bets paid back as wins. Not verified in the MVP.                                   |
| **Session**       | A player on the server: balance, rounds, debug state. Survives reconnects.                                             |
| **Stop**          | The position on a reel strip where a reel stops.                                                                       |
| **Transport**     | Client-side abstraction over how messages reach the RGS: `ws` or `demo`.                                               |
| **Ways**          | Number of distinct left-to-right paths forming one win: product of symbol counts per reel.                             |
