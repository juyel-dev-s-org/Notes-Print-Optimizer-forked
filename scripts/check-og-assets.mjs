#!/usr/bin/env node
/**
 * Live validator for social share cards (og:image / twitter:image).
 *
 * Probes every contracted card URL on the CDN and verifies what social
 * crawlers actually care about:
 *   - HTTP 200, content-type image/png, no redirect chain
 *   - PNG magic bytes + IHDR dimensions == 1200x630
 *   - weight: fail > 1 MB (crawler timeout risk), warn > 500 KB
 *
 * Slugs default to those declared in lib/tools/registry.ts; pass explicit
 * names (e.g. `home.png merge-pdf.png`) to check a subset. Zero deps.
 *
 * Usage: npm run check:og   |   node scripts/check-og-assets.mjs [names...]
 */

import { readFile } from 'node:fs/promises';

const REPO = 'juyel-dev/image';
const BASE = `https://cdn.jsdelivr.net/gh/${REPO}@main`;
const PROJECT = 'print-optimizer';
const DIMS = { w: 1200, h: 630 };
const HARD_CAP = 1024 * 1024;
const SOFT_CAP = 500 * 1024;

async function slugNamesFromRegistry() {
  const text = await readFile(new URL('../lib/tools/registry.ts', import.meta.url), 'utf8');
  return [...text.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => `${m[1]}.png`);
}

const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : await slugNamesFromRegistry();

if (!names.includes('home.png')) names.unshift('home.png');

let failures = 0;

for (const name of names) {
  const url = `${BASE}/${PROJECT}/og/${name}`;
  let res;
  try {
    res = await fetch(url, { redirect: 'manual' });
  } catch (err) {
    console.error(`FAIL ${name}: network error (${err.message})`);
    failures += 1;
    continue;
  }

  const problems = [];
  if (res.status !== 200) problems.push(`status ${res.status}`);
  if ([301, 302, 307, 308].includes(res.status)) problems.push('unexpected redirect');
  const ctype = res.headers.get('content-type') || '';
  if (!ctype.startsWith('image/png')) problems.push(`content-type "${ctype}"`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length <= 8 || !buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    problems.push('not a PNG (magic bytes)');
  } else {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w !== DIMS.w || h !== DIMS.h) problems.push(`dimensions ${w}x${h} != ${DIMS.w}x${DIMS.h}`);
  }
  if (buf.length > HARD_CAP) problems.push(`${(buf.length / 1024).toFixed(0)} KB exceeds hard cap 1 MB`);

  const kb = (buf.length / 1024).toFixed(0);
  if (problems.length) {
    failures += 1;
    console.error(`FAIL ${name} — ${problems.join('; ')}  (${url})`);
  } else if (buf.length > SOFT_CAP) {
    console.warn(`WARN ${name} — OK but ${(buf.length / 1024).toFixed(0)} KB > 500 KB target  (${url})`);
  } else {
    console.log(`OK   ${name} — 200 image/png ${DIMS.w}x${DIMS.h} ${kb} KB`);
  }
}

if (failures) {
  console.error(`\n${failures}/${names.length} card(s) FAILED — fix the image repo before sharing links.`);
  process.exit(1);
}
console.log(`\nAll ${names.length} share cards verified.`);
