/**
 * ProtectionService — thin wrapper over @pdfsmaller/pdf-encrypt.
 *
 * The module is imported lazily so its crypto code never lands in the
 * main bundle; it is fetched only when a user actually runs Protect.
 * Locks arrive as "blocked" booleans and are inverted into the PDF
 * permission bits the library expects.
 */

import type { ProtectLocks } from './protectReducer';

export interface ProtectRequest {
  bytes: Uint8Array;
  /** Open password ('' = opens freely, permissions still declared). */
  userPassword: string;
  /** Permissions master key; '' = caller already generated a random one. */
  ownerPassword: string;
  locks: ProtectLocks;
}

export class ProtectionService {
  /** 24-char alphanumeric master key via Web Crypto (rejection-sampled to
   *  avoid modulo bias — 256 is not a multiple of the 62-char alphabet, so
   *  a plain `byte % 62` would pick 'A'-'H' ~25% more often than the rest). */
  static generateOwnerPassword(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const limit = 256 - (256 % alphabet.length); // 248: largest multiple of 62 <= 256
    const chars: string[] = [];
    const buf = new Uint8Array(64); // draw in batches; a handful of bytes get rejected
    while (chars.length < 24) {
      crypto.getRandomValues(buf);
      for (const b of buf) {
        if (b < limit) chars.push(alphabet[b % alphabet.length]);
        if (chars.length === 24) break;
      }
    }
    return chars.join('');
  }

  static async protect(request: ProtectRequest): Promise<Uint8Array> {
    const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt');
    return encryptPDF(request.bytes.slice(0), request.userPassword, {
      algorithm: 'AES-256',
      ownerPassword: request.ownerPassword,
      allowPrinting: !request.locks.printing,
      allowCopying: !request.locks.copying,
      allowModifying: !request.locks.modifying,
      allowAnnotating: false,
      allowAssembly: !request.locks.modifying,
      allowHighQualityPrint: !request.locks.printing,
    });
  }
}
