/**
 * Postbuild: neutralize the Next.js dev overlay from the static export.
 *
 * Next.js 15.5.x has a bug where `next/dist/compiled/next-devtools` (~217 kB)
 * is unconditionally bundled into production builds via app-index.js with no
 * NODE_ENV guard. It renders nothing in production (no dev server to talk to)
 * but still downloads on every page. Since this is a static export
 * (`output: 'export'`) with no dev overlay functionality, we neutralize it
 * here.
 *
 * IMPORTANT: we must NOT delete the chunk. `main-app` (and every route chunk)
 * declares the devtools chunk as a webpack chunk dependency
 * (`e.O(0,[441,342,255], ...)`), so the runtime waits for it to be "loaded"
 * before bootstrapping React. Deleting the file + its <script> tag leaves the
 * runtime waiting forever and hydration silently never starts.
 *
 * Instead we shrink the chunk to a 60-byte stub that just registers the chunk
 * id as loaded with zero modules. The <script> tag stays in the HTML (it now
 * points at a 60-byte file), the runtime proceeds, and the 217 kB payload is
 * eliminated.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'out');
const CHUNKS_DIR = path.join(OUT_DIR, '_next', 'static', 'chunks');

function neutralizeDevtools() {
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

  // 2. Shrink each devtools chunk to a stub that marks it as loaded.
  for (const f of devtoolsFiles) {
    const full = path.join(CHUNKS_DIR, f);
    const buf = fs.readFileSync(full);
    const match = buf.slice(0, 4096).toString('utf8').match(/\.push\(\[\[(\d+)/);
    const chunkId = match ? match[1] : '0';
    const stub = `(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[${chunkId}],{}]);`;
    fs.writeFileSync(full, stub);
    console.log(`[postbuild] stubbed ${f} -> chunk ${chunkId} (${stub.length} bytes)`);
  }

  console.log('[postbuild] devtools chunks neutralized: ' + devtoolsFiles.join(', '));
}

neutralizeDevtools();
