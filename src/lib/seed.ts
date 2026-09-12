import { encodeBase58 } from './base58'
import { normalizeTrail, trailExtent, type TossTrail } from './trail'

export type Seed = {
  address: string
  hashHex: string
  chips: string[]
  samples: number
  bounces: number
  extent: number
  still: boolean
}

export async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return new Uint8Array(digest)
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function chipsFromAddress(address: string, count = 4, width = 4): string[] {
  const chips: string[] = []
  for (let i = 0; i < count; i++) {
    const slice = address.slice(i * width, i * width + width)
    if (slice) chips.push(slice)
  }
  return chips
}

export function formatCallsign(address: string): string {
  return address.match(/.{1,4}/g)?.join(' ') ?? address
}

export async function seedFromTrail(trail: TossTrail): Promise<Seed> {
  const bytes = normalizeTrail(trail)
  const hash = await sha256Bytes(bytes)
  const address = encodeBase58(hash)
  const extent = trailExtent(trail)
  return {
    address,
    hashHex: bytesToHex(hash),
    chips: chipsFromAddress(address),
    samples: trail.points.length,
    bounces: trail.bounces,
    extent,
    still: extent < 0.045,
  }
}
