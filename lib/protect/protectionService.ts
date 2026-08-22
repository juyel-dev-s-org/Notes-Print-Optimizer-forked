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
  /** 24-char alphanumeric master key via Web Crypto. */
  static generateOwnerPassword(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const pick = new Uint8Array(24);
    crypto.getRandomValues(pick);
    return Array.from(pick, (b) => alphabet[b % alphabet.length]).join('');
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
      allowAssembly: !request.locks.modifying ? false : true,
      allowHighQualityPrint: !request.locks.printing,
    });
  }
}
