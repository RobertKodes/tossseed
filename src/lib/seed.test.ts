import { describe, expect, it } from 'vitest'
import { chipsFromAddress, formatCallsign, seedFromTrail } from './seed'
import { restPoint, type FlightPoint, type TossTrail } from './trail'

function point(x: number, y: number): FlightPoint {
  return { x, y }
}

function toss(partial: Partial<TossTrail> & { points: FlightPoint[] }): TossTrail {
  return { vx: 0, vy: 0, spin: 0, bounces: 0, ...partial }
}

describe('seedFromTrail', () => {
  it('hashes the same trail to the same callsign', async () => {
    const trail = toss({
      vx: 1.1,
      vy: -1.4,
      spin: 2.2,
      bounces: 2,
      points: [point(0.28, 0.62), point(0.46, 0.31), point(0.7, 0.8)],
    })
    const once = await seedFromTrail(trail)
    const twice = await seedFromTrail(trail)
    expect(once.address).toBe(twice.address)
    expect(once.hashHex).toBe(twice.hashHex)
    expect(once.address.length).toBeGreaterThanOrEqual(32)
    expect(once.address.length).toBeLessThanOrEqual(44)
    expect(once.address).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
    expect(once.chips).toEqual(chipsFromAddress(once.address))
    expect(once.samples).toBe(3)
    expect(once.bounces).toBe(2)
    expect(once.still).toBe(false)
  })

  it('changes when the trail changes', async () => {
    const a = await seedFromTrail(toss({ points: [point(0.2, 0.8), point(0.8, 0.2)] }))
    const b = await seedFromTrail(toss({ points: [point(0.2, 0.8), point(0.3, 0.2)] }))
    expect(a.address).not.toBe(b.address)
  })

  it('marks a still drop', async () => {
    const p = restPoint()
    const seed = await seedFromTrail(toss({ points: [p, { ...p }] }))
    expect(seed.still).toBe(true)
    expect(seed.extent).toBe(0)
  })

  it('groups the callsign for the plate', async () => {
    const seed = await seedFromTrail(toss({ points: [restPoint()] }))
    expect(formatCallsign(seed.address).includes(' ')).toBe(true)
  })

  it('locks a known rest-point vector', async () => {
    const seed = await seedFromTrail(toss({ points: [restPoint()] }))
    expect(seed.hashHex).toBe(
      'f85946041b68155254063392ae227285dcf8f32dac840b7fbf912ce5b4dd7eb5',
    )
  })
})
