/**
 * Postbuild: strip the Next.js dev overlay from the static export.
 *
 * Next.js 15.5.x has a bug where `next/dist/compiled/next-devtools` (~217 kB
 * gzip) is unconditionally bundled into production builds via app-index.js
 * with no NODE_ENV guard. It renders nothing in production (no dev server to
 * talk to) but still downloads on every page. Since this is a static export
 * (`output: 'export'`) with no dev overlay functionality, we strip it here.
 *
 * This is a legitimate workaround for an upstream bug — the chunk is pure
 * dev-only CSS/JS that serves no purpose in a production static export.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const CHUNKS_DIR = path.join(OUT_DIR, '_next', 'static', 'chunks');

function removeDevtools() {
  if (!fs.existsSync(CHUNKS_DIR)) {
    console.log('[postbuild] no chunks dir, skipping');
    return;
  }

  // 1. Find devtools chunk files by content signature (check first 2 KB).
  const chunkFiles = fs.readdirSync(CHUNKS_DIR).filter((f) => f.endsWith('.js'));
  const devtoolsFiles = [];
  for (const f of chunkFiles) {
    const buf = fs.readFileSync(path.join(CHUNKS_DIR, f));
    const head = buf.slice(0, 2048).toString('utf8');
    if (head.includes('next-devtools') || head.includes('dev-overlay') || head.includes('devtools-panel')) {
      devtoolsFiles.push(f);
    }
  }

  if (devtoolsFiles.length === 0) {
    console.log('[postbuild] no devtools chunks found (already clean?)');
    return;
  }

  // 2. Delete the chunk files.
  for (const f of devtoolsFiles) {
    fs.unlinkSync(path.join(CHUNKS_DIR, f));
    console.log('[postbuild] removed ' + f);
  }

  // 3. Remove <script> tags referencing the deleted chunks from all HTML files.
  const htmlFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) htmlFiles.push(full);
    }
  }
  walk(OUT_DIR);

  for (const htmlFile of htmlFiles) {
    let html = fs.readFileSync(htmlFile, 'utf8');
    const before = html;
    for (const f of devtoolsFiles) {
      const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('\\s*<script[^>]*src="[^"]*' + escaped + '"[^>]*><\\/script>', 'g');
      html = html.replace(re, '');
    }
    if (html !== before) {
      fs.writeFileSync(htmlFile, html);
    }
  }

  console.log('[postbuild] cleaned ' + htmlFiles.length + ' HTML files');
}

removeDevtools();
