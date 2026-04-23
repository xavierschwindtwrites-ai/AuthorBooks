import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'build', 'icons')

const SIZE = 512
const RADIUS = 80

const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="round">
      <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}"/>
    </clipPath>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="#1e1b4b"/>
  <text
    x="${SIZE / 2}"
    y="${SIZE / 2 + 68}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="220"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="auto"
    letter-spacing="-4"
  >AB</text>
</svg>`

await sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(outDir, '512x512.png'))

console.log('Generated build/icons/512x512.png')
