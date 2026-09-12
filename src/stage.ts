import { WORLD, type Ball } from './lib/physics'
import { prefersReducedMotion } from './lib/clipboard'
import type { FlightPoint } from './lib/trail'

export type Phase = 'ready' | 'armed' | 'toss' | 'seeded'

export type StagePaint = {
  ball: Ball
  trail: readonly FlightPoint[]
  phase: Phase
  now: number
}

export function resizeCanvas(canvas: HTMLCanvasElement): { w: number; h: number } {
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(2.5, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  return { w, h }
}

export function eventToStage(canvas: HTMLCanvasElement, clientX: number, clientY: number): {
  x: number
  y: number
} {
  const rect = canvas.getBoundingClientRect()
  const x = (clientX - rect.left) / Math.max(1, rect.width)
  const y = (clientY - rect.top) / Math.max(1, rect.height)
  return { x, y }
}

function feltFill(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const field = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.08, w * 0.5, h * 0.55, h * 0.92)
  field.addColorStop(0, '#3f5a41')
  field.addColorStop(0.45, '#314a36')
  field.addColorStop(1, '#223228')
  ctx.fillStyle = field
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.strokeStyle = '#1a241c'
  ctx.lineWidth = Math.max(1, h * 0.004)
  const step = Math.max(10, w / 18)
  for (let x = 0; x < w; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  ctx.restore()
}

function oakRim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const t = Math.max(8, Math.round(h * 0.048))
  ctx.save()
  ctx.strokeStyle = '#6d4526'
  ctx.lineWidth = t
  ctx.strokeRect(t / 2, t / 2, w - t, h - t)
  ctx.strokeStyle = '#c4a46a'
  ctx.lineWidth = Math.max(1.5, t * 0.18)
  ctx.strokeRect(t * 0.72, t * 0.72, w - t * 1.44, h - t * 1.44)
  ctx.restore()
}

function floorRail(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const y = WORLD.floor * h
  const rail = Math.max(6, h * 0.028)
  ctx.save()
  const wood = ctx.createLinearGradient(0, y, 0, y + rail * 2.2)
  wood.addColorStop(0, '#d8b56a')
  wood.addColorStop(0.35, '#a87a3c')
  wood.addColorStop(1, '#5a3618')
  ctx.fillStyle = wood
  ctx.fillRect(w * WORLD.wall * 0.4, y, w * (1 - WORLD.wall * 0.8), rail * 1.7)
  ctx.fillStyle = '#2a1c12aa'
  ctx.fillRect(w * WORLD.wall * 0.4, y + rail * 1.55, w * (1 - WORLD.wall * 0.8), rail * 0.35)
  ctx.restore()
}

function paintTrail(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  trail: readonly FlightPoint[],
  phase: Phase,
): void {
  if (trail.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = phase === 'seeded' ? '#f0d48a' : '#f3e2b4'
  ctx.globalAlpha = phase === 'seeded' ? 0.72 : 0.88
  ctx.lineWidth = Math.max(2, h * 0.01)
  ctx.setLineDash([Math.max(4, h * 0.018), Math.max(5, h * 0.022)])
  ctx.beginPath()
  ctx.moveTo(trail[0]!.x * w, trail[0]!.y * h)
  for (let i = 1; i < trail.length; i++) {
    ctx.lineTo(trail[i]!.x * w, trail[i]!.y * h)
  }
  ctx.stroke()

  const last = trail[trail.length - 1]!
  ctx.setLineDash([])
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#fff6d4'
  const step = Math.max(1, Math.floor(trail.length / 16))
  for (let i = 0; i < trail.length; i += step) {
    const p = trail[i]!
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, Math.max(1.4, h * 0.007), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.arc(last.x * w, last.y * h, Math.max(2, h * 0.01), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function paintBall(ctx: CanvasRenderingContext2D, w: number, h: number, ball: Ball, phase: Phase, now: number): void {
  const cx = ball.x * w
  const cy = ball.y * h
  const r = WORLD.radius * h
  const shadowY = WORLD.floor * h + r * 0.12
  const lift = Math.max(0, shadowY - cy)
  const shadowScale = Math.max(0.35, 1 - lift / (h * 0.7))

  ctx.save()
  ctx.fillStyle = `rgba(12, 10, 8, ${0.22 + 0.2 * shadowScale})`
  ctx.beginPath()
  ctx.ellipse(cx, shadowY, r * 0.92 * shadowScale, r * 0.22 * shadowScale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(ball.angle)
  ctx.scale(ball.stretch, ball.squash)

  const felt = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r)
  felt.addColorStop(0, '#f09a78')
  felt.addColorStop(0.35, '#d45a42')
  felt.addColorStop(0.78, '#a83828')
  felt.addColorStop(1, '#6e2218')
  ctx.fillStyle = felt
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#7a2c22'
  ctx.globalAlpha = 0.28
  ctx.lineWidth = Math.max(1, r * 0.045)
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.62, 0.4, 2.2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.38, 3.2, 5.1)
  ctx.stroke()

  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#fff4e8'
  ctx.beginPath()
  ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.fillStyle = '#f0d48a'
  ctx.beginPath()
  ctx.arc(r * 0.18, r * 0.08, r * 0.11, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#5a2a1c'
  ctx.beginPath()
  ctx.arc(r * 0.18, r * 0.08, r * 0.045, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (phase === 'ready' && !prefersReducedMotion()) {
    const pulse = 0.55 + Math.sin(now * 0.0032) * 0.2
    ctx.save()
    ctx.strokeStyle = `rgba(240, 212, 138, ${0.28 + pulse * 0.2})`
    ctx.lineWidth = Math.max(1.5, r * 0.06)
    ctx.setLineDash([Math.max(4, r * 0.22), Math.max(5, r * 0.28)])
    ctx.beginPath()
    ctx.arc(cx, cy, r * (1.42 + pulse * 0.08), 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  if (phase === 'armed') {
    ctx.save()
    ctx.strokeStyle = 'rgba(240, 212, 138, 0.55)'
    ctx.lineWidth = Math.max(2, r * 0.08)
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.28, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

export function paintStage(canvas: HTMLCanvasElement, scene: StagePaint): void {
  const { w, h } = resizeCanvas(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  feltFill(ctx, w, h)
  floorRail(ctx, w, h)
  paintTrail(ctx, w, h, scene.trail, scene.phase)
  paintBall(ctx, w, h, scene.ball, scene.phase, scene.now)
  oakRim(ctx, w, h)
}
