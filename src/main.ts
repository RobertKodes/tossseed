import './style.css'
import { copyText, prefersReducedMotion } from './lib/clipboard'
import {
  FIXED_DT,
  MAX_FLIGHT,
  SETTLE_HOLD,
  applyRelease,
  hitBall,
  idleBall,
  placeGrabbed,
  pointerVelocity,
  restBall,
  stepBall,
  toPoint,
  type Ball,
} from './lib/physics'
import { formatCallsign, seedFromTrail, type Seed } from './lib/seed'
import type { FlightPoint, TossTrail } from './lib/trail'
import { eventToStage, paintStage, type Phase } from './stage'

const desk = document.querySelector<HTMLElement>('#desk')!
const statusEl = document.querySelector<HTMLElement>('#status')!
const lampEl = document.querySelector<HTMLElement>('#lamp')!
const stage = document.querySelector<HTMLCanvasElement>('#stage')!
const plate = document.querySelector<HTMLElement>('#plate')!
const addressEl = document.querySelector<HTMLElement>('#address')!
const chipsEl = document.querySelector<HTMLElement>('#chips')!
const crumb = document.querySelector<HTMLElement>('#crumb')!
const copyBtn = document.querySelector<HTMLButtonElement>('#copy')!
const againBtn = document.querySelector<HTMLButtonElement>('#again')!

let phase: Phase = 'ready'
let ball: Ball = restBall()
let seed: Seed | null = null
let developing = false
let grabOx = 0
let grabOy = 0
let flightClock = 0
let settleHold = 0
let copyReset = 0
let lastFrame = performance.now()

const pointerHist: { t: number; x: number; y: number }[] = []
let liveTrail: FlightPoint[] = []
let releaseVx = 0
let releaseVy = 0
let releaseSpin = 0
let bounces = 0

function setStatus(text: string): void {
  statusEl.textContent = text
}

function setPhase(next: Phase): void {
  phase = next
  desk.dataset.state = next
  lampEl.textContent = next === 'armed' ? 'holding' : next
}

function showPlate(next: Seed): void {
  seed = next
  plate.hidden = false
  addressEl.textContent = formatCallsign(next.address)
  chipsEl.replaceChildren(
    ...next.chips.map((chip) => {
      const el = document.createElement('span')
      el.className = 'chip'
      el.textContent = chip
      return el
    }),
  )
  crumb.textContent = next.still
    ? `still drop · ${next.hashHex.slice(0, 8)}`
    : `${next.bounces} bounce${next.bounces === 1 ? '' : 's'} · ${next.samples} pts · ${next.hashHex.slice(0, 8)}`
  setStatus(next.still ? 'callsign from a still drop' : 'callsign on the plate')
  setPhase('seeded')
  copyBtn.textContent = 'copy address'
}

function clearPlate(): void {
  seed = null
  plate.hidden = true
  addressEl.textContent = ''
  chipsEl.replaceChildren()
  crumb.textContent = ''
}

function resetToy(keepTrail = false): void {
  ball = restBall()
  flightClock = 0
  settleHold = 0
  bounces = 0
  releaseVx = 0
  releaseVy = 0
  releaseSpin = 0
  pointerHist.length = 0
  if (!keepTrail) liveTrail = []
  developing = false
}

function currentTrail(): TossTrail {
  const points = liveTrail.length > 0 ? liveTrail : [toPoint(ball)]
  return {
    vx: releaseVx,
    vy: releaseVy,
    spin: releaseSpin,
    bounces,
    points,
  }
}

async function develop(): Promise<void> {
  if (developing) return
  developing = true
  setStatus('hashing the flight')
  try {
    const trail = currentTrail()
    if (trail.points.length === 0) trail.points.push(toPoint(ball))
    showPlate(await seedFromTrail(trail))
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'could not hash that toss')
    resetToy()
    setPhase('ready')
    setStatus('grab the ball — then fling it')
  } finally {
    developing = false
  }
}

function beginGrab(x: number, y: number): void {
  if (developing) return
  if (phase === 'toss') return
  clearPlate()
  grabOx = x - ball.x
  grabOy = y - ball.y
  pointerHist.length = 0
  pointerHist.push({ t: performance.now() / 1000, x, y })
  liveTrail = []
  bounces = 0
  flightClock = 0
  settleHold = 0
  ball.vx = 0
  ball.vy = 0
  setPhase('armed')
  setStatus('holding — fling to seed')
}

function moveGrab(x: number, y: number): void {
  if (phase !== 'armed') return
  placeGrabbed(ball, x, y, grabOx, grabOy)
  const t = performance.now() / 1000
  pointerHist.push({ t, x, y })
  while (pointerHist.length > 18 || (pointerHist.length > 2 && t - pointerHist[0]!.t > 0.16)) {
    pointerHist.shift()
  }
}

function endGrab(): void {
  if (phase !== 'armed') return
  const { vx, vy } = pointerVelocity(pointerHist)
  applyRelease(ball, vx, vy)
  releaseVx = ball.vx
  releaseVy = ball.vy
  releaseSpin = ball.spin
  liveTrail = [toPoint(ball)]
  flightClock = 0
  settleHold = 0
  bounces = 0
  setPhase('toss')
  setStatus('in flight')
}

function bindStage(): void {
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || developing) return
    const { x, y } = eventToStage(stage, event.clientX, event.clientY)
    if (!hitBall(ball, x, y) && phase !== 'ready' && phase !== 'seeded') return
    if (!hitBall(ball, x, y)) return
    event.preventDefault()
    stage.setPointerCapture(event.pointerId)
    beginGrab(x, y)
  }
  const onMove = (event: PointerEvent) => {
    if (phase !== 'armed') return
    event.preventDefault()
    const { x, y } = eventToStage(stage, event.clientX, event.clientY)
    moveGrab(x, y)
  }
  const onUp = (event: PointerEvent) => {
    if (phase !== 'armed') return
    event.preventDefault()
    if (stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId)
    }
    const { x, y } = eventToStage(stage, event.clientX, event.clientY)
    moveGrab(x, y)
    endGrab()
  }
  stage.addEventListener('pointerdown', onDown)
  stage.addEventListener('pointermove', onMove)
  stage.addEventListener('pointerup', onUp)
  stage.addEventListener('pointercancel', onUp)
  stage.addEventListener('lostpointercapture', () => {
    if (phase === 'armed') endGrab()
  })
  stage.addEventListener('contextmenu', (event) => event.preventDefault())
}

function bindPlate(): void {
  copyBtn.addEventListener('click', async () => {
    if (!seed) return
    const ok = await copyText(seed.address)
    copyBtn.textContent = ok ? 'copied' : 'copy failed'
    window.clearTimeout(copyReset)
    copyReset = window.setTimeout(() => {
      copyBtn.textContent = 'copy address'
    }, 1400)
  })
  againBtn.addEventListener('click', () => {
    clearPlate()
    resetToy()
    setPhase('ready')
    setStatus('grab the ball — then fling it')
  })
}

function stepFlight(dt: number): void {
  let acc = dt
  const cap = FIXED_DT * 8
  if (acc > cap) acc = cap
  while (acc > 0 && phase === 'toss') {
    const slice = Math.min(FIXED_DT, acc)
    const result = stepBall(ball, slice)
    acc -= slice
    flightClock += slice
    liveTrail.push(toPoint(ball))
    if (result.bounced) bounces += 1
    if (result.settled) {
      settleHold += slice
    } else {
      settleHold = 0
    }
    if (settleHold >= SETTLE_HOLD || flightClock >= MAX_FLIGHT) {
      void develop()
      return
    }
  }
}

function loop(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  if (phase === 'ready' || phase === 'seeded') {
    idleBall(ball, now, prefersReducedMotion())
  }
  if (phase === 'toss') stepFlight(dt)
  const trail = phase === 'ready' ? [] : liveTrail
  paintStage(stage, { ball, trail, phase, now })
  requestAnimationFrame(loop)
}

function boot(): void {
  bindStage()
  bindPlate()
  resetToy()
  setPhase('ready')
  setStatus('grab the ball — then fling it')
  requestAnimationFrame(loop)
}

boot()
