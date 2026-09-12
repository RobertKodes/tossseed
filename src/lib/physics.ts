import { clamp01, restPoint, type FlightPoint } from './trail'

/** Stage is unit square: x right, y down. */
export type Ball = {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  squash: number
  stretch: number
}

export type World = {
  radius: number
  floor: number
  wall: number
  ceiling: number
}

export type StepResult = {
  bounced: boolean
  settled: boolean
}

export const WORLD: World = {
  radius: 0.078,
  floor: 0.882,
  wall: 0.056,
  ceiling: 0.07,
}

export const FIXED_DT = 1 / 120
export const GRAVITY = 2.55
export const RESTITUTION = 0.58
export const WALL_RESTITUTION = 0.46
export const FLOOR_FRICTION = 0.84
export const AIR_DRAG = 0.22
export const SPIN_DAMP = 0.55
export const MAX_SPEED = 3.8
export const SETTLE_SPEED = 0.085
export const SETTLE_HOLD = 0.36
export const MAX_FLIGHT = 5.4
export const GRAB_SLOP = 1.85
export const RELEASE_WINDOW = 0.08

const IMPACT_MIN = 0.11

export function restBall(): Ball {
  const p = restPoint()
  return {
    x: p.x,
    y: WORLD.floor - WORLD.radius,
    vx: 0,
    vy: 0,
    angle: 0,
    spin: 0,
    squash: 1,
    stretch: 1,
  }
}

export function cloneBall(ball: Ball): Ball {
  return { ...ball }
}

export function hitBall(ball: Ball, x: number, y: number, slop = GRAB_SLOP): boolean {
  return Math.hypot(x - ball.x, y - ball.y) <= WORLD.radius * slop
}

export function clampSpeed(vx: number, vy: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy)
  if (speed <= MAX_SPEED) return { vx, vy }
  const s = MAX_SPEED / speed
  return { vx: vx * s, vy: vy * s }
}

export function pointerVelocity(
  samples: readonly { t: number; x: number; y: number }[],
  windowSec = RELEASE_WINDOW,
): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]!
  const cutoff = last.t - windowSec
  let first = samples[0]!
  for (let i = samples.length - 2; i >= 0; i--) {
    const s = samples[i]!
    first = s
    if (s.t <= cutoff) break
  }
  const dt = last.t - first.t
  if (dt < 0.012) return { vx: 0, vy: 0 }
  return clampSpeed((last.x - first.x) / dt, (last.y - first.y) / dt)
}

function bounceAxis(
  pos: number,
  vel: number,
  min: number,
  max: number,
  rest: number,
): { pos: number; vel: number; hit: boolean; impact: number } {
  if (pos < min) {
    const impact = Math.abs(vel)
    return { pos: min, vel: -vel * rest, hit: true, impact }
  }
  if (pos > max) {
    const impact = Math.abs(vel)
    return { pos: max, vel: -vel * rest, hit: true, impact }
  }
  return { pos, vel, hit: false, impact: 0 }
}

export function stepBall(ball: Ball, dt: number): StepResult {
  let { x, y, vx, vy, angle, spin, squash, stretch } = ball
  const r = WORLD.radius
  const minX = WORLD.wall + r
  const maxX = 1 - WORLD.wall - r
  const minY = WORLD.ceiling + r
  const maxY = WORLD.floor - r

  vx *= Math.max(0, 1 - AIR_DRAG * dt)
  vy *= Math.max(0, 1 - AIR_DRAG * dt)
  vy += GRAVITY * dt
  ;({ vx, vy } = clampSpeed(vx, vy))

  x += vx * dt
  y += vy * dt
  angle += spin * dt
  spin *= Math.max(0, 1 - SPIN_DAMP * dt)

  let bounced = false
  const floor = bounceAxis(y, vy, minY, maxY, RESTITUTION)
  y = floor.pos
  vy = floor.vel
  if (floor.hit) {
    if (y >= maxY - 1e-6) {
      vx *= FLOOR_FRICTION
      spin += vx * 6.5
      if (floor.impact > IMPACT_MIN) bounced = true
      if (floor.impact < SETTLE_SPEED) vy = 0
    } else if (floor.impact > IMPACT_MIN) {
      bounced = true
    }
    squash = Math.max(0.62, 1 - floor.impact * 0.28)
    stretch = 1 + (1 - squash) * 0.55
  }

  const wall = bounceAxis(x, vx, minX, maxX, WALL_RESTITUTION)
  x = wall.pos
  vx = wall.vel
  if (wall.hit && wall.impact > IMPACT_MIN) {
    bounced = true
    spin -= vy * 4.2
    stretch = Math.max(0.68, 1 - wall.impact * 0.2)
  }

  squash += (1 - squash) * Math.min(1, dt * 10)
  stretch += (1 - stretch) * Math.min(1, dt * 9)

  const onFloor = y >= maxY - 0.002
  const slow = Math.hypot(vx, vy) < SETTLE_SPEED
  const settled = onFloor && slow

  if (settled) {
    vx = 0
    vy = 0
    y = maxY
    squash += (1 - squash) * 0.4
    stretch += (1 - stretch) * 0.4
  }

  ball.x = x
  ball.y = y
  ball.vx = vx
  ball.vy = vy
  ball.angle = angle
  ball.spin = spin
  ball.squash = squash
  ball.stretch = stretch
  return { bounced, settled }
}

export function integrateFlight(
  start: Ball,
  seconds: number,
  dt = FIXED_DT,
): { ball: Ball; points: FlightPoint[]; bounces: number } {
  const ball = cloneBall(start)
  const points: FlightPoint[] = [{ x: clamp01(ball.x), y: clamp01(ball.y) }]
  let bounces = 0
  let t = 0
  let settleHold = 0
  while (t < seconds) {
    const result = stepBall(ball, dt)
    t += dt
    points.push({ x: clamp01(ball.x), y: clamp01(ball.y) })
    if (result.bounced) bounces += 1
    if (result.settled) {
      settleHold += dt
      if (settleHold >= SETTLE_HOLD) break
    } else {
      settleHold = 0
    }
  }
  return { ball, points, bounces }
}

export function placeGrabbed(ball: Ball, x: number, y: number, ox: number, oy: number): void {
  const r = WORLD.radius
  ball.x = Math.min(1 - WORLD.wall - r, Math.max(WORLD.wall + r, x - ox))
  ball.y = Math.min(WORLD.floor - r, Math.max(WORLD.ceiling + r, y - oy))
  ball.vx = 0
  ball.vy = 0
  ball.squash = 0.9
  ball.stretch = 1.06
}

export function applyRelease(ball: Ball, vx: number, vy: number): void {
  const clamped = clampSpeed(vx, vy)
  ball.vx = clamped.vx
  ball.vy = clamped.vy
  ball.spin = clamped.vx * 7.2 - clamped.vy * 1.4
  ball.squash = 0.86
  ball.stretch = 1.12
}

export function idleBall(ball: Ball, now: number, reduced: boolean): void {
  if (reduced) {
    ball.squash = 1
    ball.stretch = 1
    return
  }
  const breath = Math.sin(now * 0.0024) * 0.018
  ball.squash = 1 - breath
  ball.stretch = 1 + breath * 0.6
  ball.angle += 0.0004
}

export function toPoint(ball: Ball): FlightPoint {
  return { x: clamp01(ball.x), y: clamp01(ball.y) }
}
