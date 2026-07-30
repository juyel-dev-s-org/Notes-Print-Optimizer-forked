import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const pub = resolve(root, 'public');

const svg = readFileSync(resolve(pub, 'icon.svg'));

await sharp(svg).resize(192, 192).png().toFile(resolve(pub, 'icon-192.png'));
console.log('icon-192.png OK');

await sharp(svg).resize(512, 512).png().toFile(resolve(pub, 'icon-512.png'));
console.log('icon-512.png OK');

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#312e81"/></linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <g transform="translate(51, 51) scale(0.8)">
    <rect x="96" y="64" width="320" height="384" rx="32" fill="none" stroke="#ffffff" stroke-width="28" stroke-linejoin="round"/>
    <rect x="160" y="128" width="192" height="48" rx="12" fill="#ffffff" opacity="0.2"/>
    <rect x="160" y="208" width="192" height="10" rx="5" fill="#ffffff" opacity="0.5"/>
    <rect x="160" y="240" width="160" height="10" rx="5" fill="#ffffff" opacity="0.5"/>
    <rect x="160" y="272" width="176" height="10" rx="5" fill="#ffffff" opacity="0.5"/>
    <rect x="160" y="320" width="80" height="8" rx="4" fill="#ffffff" opacity="0.3"/>
    <path d="M352 64h48l64 64v288a32 32 0 0 1-32 32h-32" fill="none" stroke="#ffffff" stroke-width="28" stroke-linejoin="round"/>
    <path d="M400 64v48a16 16 0 0 0 16 16h48" fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="400" cy="400" r="64" fill="#22c55e" opacity="0.15"/>
    <path d="M376 400l16 16 24-32" fill="none" stroke="#22c55e" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

writeFileSync(resolve(pub, 'icon-maskable.svg'), maskableSvg);
await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(resolve(pub, 'icon-maskable.png'));
console.log('icon-maskable.png OK');
