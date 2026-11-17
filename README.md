# make.fun

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/pero819412/make.fun/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/pero819412/make.fun/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Signal ranks eligible pre-token protocols from the frozen snapshot and provides category-specific farm plans. Its shared browser/Node model shrinks category median market-cap/TVL ratios toward the global median, then applies clamped growth and listing maturity factors. The dashboard recomputes every value locally and exposes peer counts, calibration inputs and estimated plan budgets.

## Run it

With Node 22 supporting TypeScript execution (or a newer Node release), run from this directory:

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

Open `out/dashboard/index.html` to explore the generated snapshot offline.

---
<sub>Entered on [make.fun](https://make.fun/?ref=39ywca9b&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
