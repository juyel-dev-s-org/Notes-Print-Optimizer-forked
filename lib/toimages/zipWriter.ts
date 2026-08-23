/**
 * Minimal ZIP (STORE method) writer — zero dependencies.
 *
 * Images are already compressed, so STORE is both correct and optimal:
 * no inflate machinery, just CRC-32 + headers. Output is a spec-conformant
 * archive readable by every OS/unzip tool.
 */

export interface ZipEntry {
  /** UTF-8 entry name inside the archive ("folder/name.jpg" allowed). */
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS epoch timestamp (2-second granularity); fixed to build time. */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff,
    date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
  };
}

function writeUtf8(view: DataView, bytes: Uint8Array, offset: number): number {
  new Uint8Array(view.buffer).set(bytes, offset);
  return offset + bytes.length;
}

/** Builds a complete ZIP archive from entries, in order. */
export function buildZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const names = entries.map((e) => encoder.encode(e.name));
  const { time, date } = dosDateTime(now);

  let localSize = 0;
  for (let i = 0; i < entries.length; i++) {
    localSize += 30 + names[i].length + entries[i].data.length;
  }
  const centralSize = entries.reduce((sum, _e, i) => sum + 46 + names[i].length, 0);
  const totalSize = localSize + centralSize + 22;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let off = 0;
  const offsets: number[] = [];

  // Local file records
  for (let i = 0; i < entries.length; i++) {
    const crc = crc32(entries[i].data);
    offsets.push(off);
    view.setUint32(off, 0x04034b50, true); // local header signature
    view.setUint16(off + 4, 20, true); // version needed
    view.setUint16(off + 6, 0x0800, true); // flags: UTF-8 names
    view.setUint16(off + 8, 0, true); // method: STORE
    view.setUint16(off + 10, time, true);
    view.setUint16(off + 12, date, true);
    view.setUint32(off + 14, crc, true);
    view.setUint32(off + 18, entries[i].data.length, true); // compressed
    view.setUint32(off + 22, entries[i].data.length, true); // uncompressed
    view.setUint16(off + 26, names[i].length, true);
    view.setUint16(off + 28, 0, true); // extra len
    off += 30;
    off = writeUtf8(view, names[i], off);
    off = writeUtf8(view, entries[i].data, off);
  }

  // Central directory
  const centralStart = off;
  for (let i = 0; i < entries.length; i++) {
    const crc = crc32(entries[i].data);
    view.setUint32(off, 0x02014b50, true);
    view.setUint16(off + 4, 20, true); // version made by
    view.setUint16(off + 6, 20, true); // version needed
    view.setUint16(off + 8, 0x0800, true);
    view.setUint16(off + 10, 0, true);
    view.setUint16(off + 12, time, true);
    view.setUint16(off + 14, date, true);
    view.setUint32(off + 16, crc, true);
    view.setUint32(off + 20, entries[i].data.length, true);
    view.setUint32(off + 24, entries[i].data.length, true);
    view.setUint16(off + 28, names[i].length, true);
    // extra/comment/disk/internal attrs all zero
    view.setUint32(off + 42, offsets[i], true); // local header offset
    off += 46;
    off = writeUtf8(view, names[i], off);
  }

  // End of central directory
  view.setUint32(off, 0x06054b50, true);
  view.setUint16(off + 4, 0, true);
  view.setUint16(off + 6, 0, true);
  view.setUint16(off + 8, entries.length, true);
  view.setUint16(off + 10, entries.length, true);
  view.setUint32(off + 12, off - centralStart, true);
  view.setUint32(off + 16, centralStart, true);
  view.setUint16(off + 20, 0, true);

  return new Uint8Array(buffer);
}
