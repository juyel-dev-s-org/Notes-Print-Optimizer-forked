import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ProtectionService } from '../../lib/protect/protectionService';

/**
 * Regression test for a real bug (PROGRESS.md Finding #6): `allowAssembly`
 * was computed with an inverted ternary (`!locks.modifying ? false : true`,
 * equivalent to `locks.modifying` unnegated) while every sibling permission
 * uses the plain negated sense (`!locks.X`). Net effect: locking "Prevent
 * modifying" in the UI left page assembly (insert/delete/rotate/reorder
 * pages) OPEN, and leaving it unlocked left assembly BLOCKED — the exact
 * opposite of user intent in both directions.
 *
 * This is deliberately NOT mocked (unlike protect.test.ts's reducer tests)
 * — it calls the real @pdfsmaller/pdf-encrypt and reads back the actual /P
 * permission bits from the produced PDF, per PDF32000 Table 22 (bit 4 =
 * value 8 = modify contents, bit 11 = value 1024 = assemble document).
 * A mock-based assertion on "what was passed to encryptPDF" can't catch a
 * bug where the right-looking object was itself computed wrong — this is
 * exactly the gap that let the original bug ship silently.
 */

async function buildTiny(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  return doc.save();
}

function readPermissionBits(encrypted: Uint8Array): { canModify: boolean; canAssemble: boolean } {
  const text = Buffer.from(encrypted).toString('latin1');
  const m = text.match(/\/P\s+(-?\d+)/);
  if (!m) throw new Error('no /P entry found in encrypted PDF trailer');
  const P = parseInt(m[1], 10);
  return { canModify: (P & 8) !== 0, canAssemble: (P & 1024) !== 0 };
}

describe('ProtectionService real permission bits', () => {
  it('locking "modifying" blocks both content edits AND page assembly', async () => {
    const bytes = await buildTiny();
    const out = await ProtectionService.protect({
      bytes,
      userPassword: '',
      ownerPassword: 'ownerpw123',
      locks: { printing: false, copying: false, modifying: true },
    });
    const { canModify, canAssemble } = readPermissionBits(out);
    expect(canModify).toBe(false);
    expect(canAssemble).toBe(false); // previously true — the bug
  });

  it('leaving "modifying" unlocked allows both content edits AND page assembly', async () => {
    const bytes = await buildTiny();
    const out = await ProtectionService.protect({
      bytes,
      userPassword: '',
      ownerPassword: 'ownerpw123',
      locks: { printing: false, copying: false, modifying: false },
    });
    const { canModify, canAssemble } = readPermissionBits(out);
    expect(canModify).toBe(true);
    expect(canAssemble).toBe(true); // previously false — the bug
  });
});
