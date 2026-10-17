# NEXUS//CORP — OPS DECK

**Idle corporate tycoon + a 20-cabinet arcade, entirely in the browser.**
No install, no build step, no external assets. Open `index.html` over HTTP and play.

## Play it

```bash
cd nexus-corp
python3 -m http.server 8000
# then open http://127.0.0.1:8000/
```

ES modules require HTTP — `file://` will not work.

## The loop

1. **Run code** — mash the terminal for cash and build a combo multiplier.
2. **Buy gear** — keyboards, monitors, an AI copilot, fibre lines: permanent click power.
3. **Open departments** — ten divisions, each earning per second.
4. **Hire executives** — they automate departments and later buy gear for you.
5. **Go public** — reset the company for **Executive Shares**, worth a permanent +10 % each.

Every cabinet score converts straight to cash *and* fires a five-minute
**Overclock** that multiplies total production.

## Engine invariants

These are enforced in code and covered by the unit suite, not just intended:

| Rule | Where |
| --- | --- |
| `dt = min(raw, 0.033)` — lag can never teleport anything through a wall | `src/core/engine.js` |
| anything above **400 px/s** integrates in **4 clamped sub-steps** | `integrate()` in `src/core/engine.js` |
| exact AABB / circle / circle-AABB collision with penetration resolution | `src/arcade/kernel/collide.js` |
| one rAF owner; switching cabinets cancels it and drops every listener | `src/arcade/machine.js` |

## Layout

```
index.html
styles/     base · shell · widgets · cabinet
src/core/   math · money · rng · bus · engine · sfx · strings · save
src/tycoon/ ledger · gear · execs · ipo · store
src/arcade/ kernel/{vec2,shapes,collide,loop,input,render} · machine · registry
src/arcade/games/   20 self-contained cabinets
tests/run.js        183 assertions, plain node
tools/browser.js    headless-Chromium smoke + end-to-end run
```

## Verify

```bash
npm test          # 183/183 unit checks
npm run verify    # unit checks + headless browser: 20/20 cabinets, 57/57 e2e
```

## The twenty cabinets

Bug Squasher · Flappy Packet · Brick Firewall · Data Catcher · Cyber Runner ·
Silicon Snake · Malware Invaders · Chip Merge · Executive Pong · Memory Matrix ·
Tower Stacker · Asteroid Firewall · Security Minesweeper · Vault Lockpicker ·
Data Frogger · Orbital Dodge · Stock Scalper · Circuit Plumber · Speed Coder ·
DDoS Boss

Cabinet 01 is free; the rest unlock at $10K.