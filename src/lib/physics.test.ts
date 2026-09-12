import { describe, expect, it } from 'vitest'
import {
  applyRelease,
  integrateFlight,
  pointerVelocity,
  restBall,
  stepBall,
} from './physics'
import { normalizeTrail } from './trail'

describe('pointerVelocity', () => {
  it('is zero with fewer than two samples', () => {
    expect(pointerVelocity([{ t: 0, x: 0.2, y: 0.5 }])).toEqual({ vx: 0, vy: 0 })
  })

  it('uses the release window, not the whole drag', () => {
    const { vx, vy } = pointerVelocity([
      { t: 0, x: 0.1, y: 0.7 },
      { t: 0.4, x: 0.2, y: 0.6 },
      { t: 0.45, x: 0.28, y: 0.42 },
      { t: 0.5, x: 0.36, y: 0.24 },
    ])
    expect(vx).toBeGreaterThan(1)
    expect(vy).toBeLessThan(0)
  })
})

describe('integrateFlight', () => {
  it('is deterministic for the same release', () => {
    const start = restBall()
    applyRelease(start, 1.4, -1.8)
    const a = integrateFlight(start, 2)
    const b = integrateFlight(start, 2)
    expect(a.bounces).toBe(b.bounces)
    expect(a.points).toEqual(b.points)
    expect(
      normalizeTrail({
        vx: start.vx,
        vy: start.vy,
        spin: start.spin,
        bounces: a.bounces,
        points: a.points,
      }),
    ).toEqual(
      normalizeTrail({
        vx: start.vx,
        vy: start.vy,
        spin: start.spin,
        bounces: b.bounces,
        points: b.points,
      }),
    )
  })

  it('records floor impacts on a fling', () => {
    const start = restBall()
    applyRelease(start, 1.6, -2.1)
    const flight = integrateFlight(start, 3)
    expect(flight.bounces).toBeGreaterThan(0)
    expect(flight.points.length).toBeGreaterThan(20)
  })
})

describe('stepBall', () => {
  it('keeps a resting ball on the rail', () => {
    const ball = restBall()
    const before = { x: ball.x, y: ball.y }
    const result = stepBall(ball, 1 / 120)
    expect(result.settled).toBe(true)
    expect(ball.x).toBeCloseTo(before.x)
    expect(ball.y).toBeCloseTo(before.y)
    expect(ball.vx).toBe(0)
    expect(ball.vy).toBe(0)
  })
})
