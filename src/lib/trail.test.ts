import { describe, expect, it } from 'vitest'
import {
  TARGET_SAMPLES,
  TRAIL_DOMAIN,
  emptyTrail,
  normalizeTrail,
  packTrail,
  quantizeUnit,
  resampleTrail,
  restPoint,
  trailExtent,
  type FlightPoint,
  type TossTrail,
} from './trail'

function point(x: number, y: number): FlightPoint {
  return { x, y }
}

function toss(partial: Partial<TossTrail> & { points: FlightPoint[] }): TossTrail {
  return { vx: 0, vy: 0, spin: 0, bounces: 0, ...partial }
}

describe('quantizeUnit', () => {
  it('rounds to 1e-4 of the stage', () => {
    expect(quantizeUnit(0.12344)).toBe(1234)
    expect(quantizeUnit(0.12346)).toBe(1235)
  })

  it('clamps to 0..1', () => {
    expect(quantizeUnit(-0.2)).toBe(0)
    expect(quantizeUnit(1.4)).toBe(10_000)
  })
})

describe('resampleTrail', () => {
  it('emits a fixed pose count', () => {
    const samples = [point(0.1, 0.2), point(0.4, 0.3), point(0.8, 0.5)]
    expect(resampleTrail(samples).length).toBe(TARGET_SAMPLES)
  })

  it('repeats a single pose', () => {
    const one = [point(0.2, 0.7)]
    const out = resampleTrail(one, 4)
    expect(out).toHaveLength(4)
    expect(out.every((s) => s.x === 0.2 && s.y === 0.7)).toBe(true)
  })

  it('interpolates endpoints', () => {
    const out = resampleTrail([point(0, 0), point(1, 0.5)], 3)
    expect(out[0]?.x).toBeCloseTo(0)
    expect(out[1]?.x).toBeCloseTo(0.5)
    expect(out[2]?.x).toBeCloseTo(1)
    expect(out[1]?.y).toBeCloseTo(0.25)
  })
})

describe('packTrail', () => {
  it('writes a header plus 4 bytes per resampled pose', () => {
    const bytes = packTrail(toss({ vx: 1.2, vy: -0.4, spin: 2.5, bounces: 3, points: [restPoint()] }))
    expect(bytes.byteLength).toBe(8 + TARGET_SAMPLES * 4)
    const view = new DataView(bytes.buffer)
    expect(view.getInt16(0, true)).toBe(1200)
    expect(view.getInt16(2, true)).toBe(-400)
    expect(view.getInt16(4, true)).toBe(250)
    expect(bytes[6]).toBe(3)
  })
})

describe('normalizeTrail', () => {
  it('rejects an empty trail', () => {
    expect(() => normalizeTrail(emptyTrail())).toThrow(/empty trail/)
  })

  it('prefixes the domain and a fixed window', () => {
    const bytes = normalizeTrail(toss({ points: [restPoint()] }))
    const domain = new TextEncoder().encode(TRAIL_DOMAIN)
    expect(bytes.slice(0, domain.length)).toEqual(domain)
    expect(bytes.byteLength).toBe(domain.length + 8 + TARGET_SAMPLES * 4)
  })

  it('is stable for the same path at different tempos', () => {
    const slow = toss({
      vx: 0.8,
      vy: -1.1,
      bounces: 1,
      points: [point(0.2, 0.8), point(0.4, 0.5), point(0.7, 0.8)],
    })
    const fast = toss({
      vx: 0.8,
      vy: -1.1,
      bounces: 1,
      points: [
        point(0.2, 0.8),
        point(0.3, 0.65),
        point(0.4, 0.5),
        point(0.55, 0.65),
        point(0.7, 0.8),
      ],
    })
    expect(normalizeTrail(slow)).toEqual(normalizeTrail(fast))
  })

  it('changes when the path changes', () => {
    const a = normalizeTrail(toss({ points: [point(0.2, 0.8), point(0.7, 0.3)] }))
    const b = normalizeTrail(toss({ points: [point(0.2, 0.8), point(0.3, 0.3)] }))
    expect(a).not.toEqual(b)
  })

  it('changes when release velocity changes', () => {
    const points = [point(0.2, 0.7), point(0.5, 0.4)]
    const a = normalizeTrail(toss({ vx: 0.4, points }))
    const b = normalizeTrail(toss({ vx: 1.4, points }))
    expect(a).not.toEqual(b)
  })

  it('changes when bounce count changes', () => {
    const points = [point(0.2, 0.7), point(0.5, 0.8)]
    const a = normalizeTrail(toss({ bounces: 0, points }))
    const b = normalizeTrail(toss({ bounces: 2, points }))
    expect(a).not.toEqual(b)
  })
})

describe('trailExtent', () => {
  it('is zero for a still hold', () => {
    const p = restPoint()
    expect(trailExtent(toss({ points: [p, p] }))).toBe(0)
  })

  it('grows with travel', () => {
    expect(
      trailExtent(toss({ points: [point(0.1, 0.8), point(0.8, 0.2)] })),
    ).toBeGreaterThan(0.8)
  })
})
