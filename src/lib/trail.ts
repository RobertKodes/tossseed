/** One pose on the flight trail. Positions are stage-normalized 0..1. */
export type FlightPoint = {
  x: number
  y: number
}

/**
 * A finished toss: release velocity (stage units / s), spin (rad / s),
 * floor impacts, and the sampled arc.
 */
export type TossTrail = {
  vx: number
  vy: number
  spin: number
  bounces: number
  points: FlightPoint[]
}

/** Fixed pose count so frame rate does not change the hash — the path does. */
export const TARGET_SAMPLES = 48

/** Domain separator mixed into the digest. */
export const TRAIL_DOMAIN = 'tossseed\n'

const SCALE_POS = 10_000
const SCALE_VEL = 1_000
const SCALE_SPIN = 100

export function restPoint(): FlightPoint {
  return { x: 0.32, y: 0.8 }
}

export function emptyTrail(): TossTrail {
  return { vx: 0, vy: 0, spin: 0, bounces: 0, points: [] }
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function quantizeUnit(n: number, scale = SCALE_POS): number {
  const q = Math.round(clamp01(n) * scale)
  return Math.min(scale, Math.max(0, q))
}

export function quantizeSigned(n: number, scale: number, limit: number): number {
  const q = Math.round(n * scale)
  return Math.min(limit, Math.max(-limit, q))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPoint(a: FlightPoint, b: FlightPoint, t: number): FlightPoint {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

export function resampleTrail(
  points: readonly FlightPoint[],
  count = TARGET_SAMPLES,
): FlightPoint[] {
  if (count < 1) return []
  if (points.length === 0) return []
  if (points.length === 1) {
    return Array.from({ length: count }, () => ({ ...points[0]! }))
  }

  const out: FlightPoint[] = []
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * (points.length - 1)
    const i0 = Math.floor(t)
    const i1 = Math.min(points.length - 1, i0 + 1)
    const f = t - i0
    out.push(lerpPoint(points[i0]!, points[i1]!, f))
  }
  return out
}

/** Little-endian: vx vy spin (i16) · bounces (u8) · pad · then x y i16 pairs. */
export function packTrail(trail: TossTrail): Uint8Array {
  const points = resampleTrail(trail.points, TARGET_SAMPLES)
  const bytes = new Uint8Array(8 + points.length * 4)
  const view = new DataView(bytes.buffer)
  view.setInt16(0, quantizeSigned(trail.vx, SCALE_VEL, 32767), true)
  view.setInt16(2, quantizeSigned(trail.vy, SCALE_VEL, 32767), true)
  view.setInt16(4, quantizeSigned(trail.spin, SCALE_SPIN, 32767), true)
  bytes[6] = Math.min(255, Math.max(0, Math.round(trail.bounces)))
  bytes[7] = 0
  let o = 8
  for (const p of points) {
    view.setInt16(o, quantizeUnit(p.x), true)
    o += 2
    view.setInt16(o, quantizeUnit(p.y), true)
    o += 2
  }
  return bytes
}

export function normalizeTrail(trail: TossTrail): Uint8Array {
  if (trail.points.length === 0) {
    throw new Error('empty trail')
  }
  const packed = packTrail(trail)
  const domain = new TextEncoder().encode(TRAIL_DOMAIN)
  const out = new Uint8Array(domain.length + packed.length)
  out.set(domain, 0)
  out.set(packed, domain.length)
  return out
}

/** Path length in stage units (0..~√2) plus a little release-speed weight. */
export function trailExtent(trail: TossTrail): number {
  let length = 0
  for (let i = 1; i < trail.points.length; i++) {
    const a = trail.points[i - 1]!
    const b = trail.points[i]!
    length += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return length + Math.hypot(trail.vx, trail.vy) * 0.08
}

export function trailArc(points: readonly FlightPoint[]): FlightPoint[] {
  return points.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }))
}
