# tossseed

Grab a felt ball. Fling it. Hash the flight. Get a Solana-ish address out.

Live: **https://robertkodes.github.io/tossseed/**

Sibling to [keyseed](https://github.com/RobertKodes/keyseed) (cadence), [tiltseed](https://github.com/RobertKodes/tiltseed) (tilt), [micseed](https://github.com/RobertKodes/micseed) (hearing), [camseed](https://github.com/RobertKodes/camseed) (light), and [drawseed](https://github.com/RobertKodes/drawseed) (ink). Physics you can grab is the input. Not a wallet, not an explorer, not a fee/slot costume, and not [rpcjelly](https://github.com/RobertKodes/rpcjelly).

## Design thesis

A green felt stage on a dark desk — marble-run, desk-toy, one bounce rail.
The ball is wool. The trail is chalk. The address arrives like a callsign, stamped in mono.
No Inter, no purple, no cards, no hero: hold, toss, take a seed.

Type: **Petrona** (desk face) + **IBM Plex Mono** (callsign). Fallbacks are Palatino / Courier New.

| token | hex | job |
| --- | --- | --- |
| `desk` | `#1a1610` | dark field |
| `felt` | `#2f4634` | playfield |
| `oak` | `#6b4428` | rim |
| `wool` | `#d45a42` | the ball |
| `brass` | `#c9a35a` | rail / chips |
| `ivory` | `#f3ead6` | warm ink |
| `soot` | `#8a7a64` | mute labels |

## How it works

1. **Hold / arm** the ball (mouse, finger, or pen). The grab is the whole control — no extra plunger.
2. **Toss.** Release with velocity. A small 2D integrator applies gravity against one bounce rail, plus the oak walls. Flight is sampled at a fixed timestep so refresh rate does not rewrite the path.
3. The trail stores release velocity, spin, bounce count, and arc points normalized to the stage (`x,y` in 0..1). That window is resampled to 48 poses, prefixed with a `tossseed` domain, then **SHA-256** (Web Crypto).
4. The 32-byte digest is **base58**-encoded (Solana alphabet). That string is 32–44 chars — a PDA-*looking* preview, not `findProgramAddress` with a program id.
5. Copy the callsign. **Toss again** puts the ball back on the rail.

No wallet, no signing, no RPC. This is a *preview* seed from the toss. It is not a real program-derived PDA. Do not send funds to a bounce.

## Local

```bash
npm i
npm run dev
```

The app is built at `/tossseed/` (GitHub Pages project path). Production check:

```bash
npm run build && npm run preview
```

Tests (hash + base58 + trajectory stability):

```bash
npm test
```

## Pages

`vite.config.ts` sets `base: '/tossseed/'`. Push to `main` runs `.github/workflows/pages.yml`, which builds and force-pushes `dist/` (plus `.nojekyll`) to the `gh-pages` branch via `peaceiris/actions-gh-pages`.

Manual republish:

```bash
npm run pages
```

If https://robertkodes.github.io/tossseed/ 404s, flip **Settings → Pages → Deploy from a branch → `gh-pages` / `/` (root)** once. Same source as keyseed, tiltseed, micseed, camseed, and drawseed.

## What this refuses

No wallet connect, no signing seeds, no trading, no scoreboard. The hash is a preview seed from a fling, not a keypair.
