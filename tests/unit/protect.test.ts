/**
 * Unit tests for the Protect tool: reducer transitions, filename
 * sanitization, owner-password generation and the lock->permission-bit
 * inversion handed to @pdfsmaller/pdf-encrypt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INITIAL_PROTECT_STATE,
  protectReducer,
  sanitizeBaseName,
  type ProtectState,
} from '@/lib/protect/protectReducer';
import { ProtectionService } from '@/lib/protect/protectionService';

vi.mock('@pdfsmaller/pdf-encrypt', () => ({
  encryptPDF: vi.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
}));

const withFile = (): ProtectState => ({
  ...INITIAL_PROTECT_STATE,
  step: 'options',
  source: { name: 'notes.pdf', baseName: 'notes', sizeMB: '1.2', bytes: new Uint8Array([1]) },
});

describe('protectReducer', () => {
  it('SET_FILE lands on options and clears previous results', () => {
    const s = protectReducer(
      { ...INITIAL_PROTECT_STATE, resultBlob: new Blob(), userPassword: 'old' },
      { type: 'SET_FILE', source: { name: 'a.pdf', baseName: 'a', sizeMB: '1', bytes: new Uint8Array() } },
    );
    expect(s.step).toBe('options');
    expect(s.userPassword).toBe('');
    expect(s.resultBlob).toBeNull();
  });

  it('TOGGLE_LOCK flips only the targeted lock', () => {
    let s = protectReducer(withFile(), { type: 'TOGGLE_LOCK', key: 'printing' });
    expect(s.locks.printing).toBe(true);
    expect(s.locks.copying).toBe(false);
    s = protectReducer(s, { type: 'TOGGLE_LOCK', key: 'printing' });
    expect(s.locks.printing).toBe(false);
  });

  it('busy lifecycle completes onto the done step', () => {
    let s = protectReducer(withFile(), { type: 'PROTECT_START', progress: { pct: 10, label: 'x' } });
    expect(s.isBusy).toBe(true);
    s = protectReducer(s, { type: 'PROTECT_PROGRESS', progress: { pct: 50, label: 'y' } });
    expect(s.progress?.pct).toBe(50);
    const blob = new Blob(['%PDF']);
    s = protectReducer(s, { type: 'PROTECT_COMPLETE', blob });
    expect(s.isBusy).toBe(false);
    expect(s.resultBlob).toBe(blob);
    expect(s.step).toBe('done');
  });

  it('PROTECT_ERROR surfaces a message and unlocks the UI', () => {
    let s = protectReducer(withFile(), { type: 'PROTECT_START', progress: { pct: 10, label: 'x' } });
    s = protectReducer(s, { type: 'PROTECT_ERROR', error: 'boom' });
    expect(s.isBusy).toBe(false);
    expect(s.error).toBe('boom');
  });
});

describe('sanitizeBaseName', () => {
  it('strips filesystem-hostile characters and caps length', () => {
    expect(sanitizeBaseName('my: notes*draft?.pdf')).toBe('my notesdraft.pdf');
    expect(sanitizeBaseName('  spaced   out  ')).toBe('spaced out');
    expect(sanitizeBaseName('x'.repeat(200))).toHaveLength(80);
  });
});

describe('ProtectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a 24-char alphanumeric owner password', () => {
    const pw = ProtectionService.generateOwnerPassword();
    expect(pw).toMatch(/^[a-zA-Z0-9]{24}$/);
    expect(ProtectionService.generateOwnerPassword()).not.toBe(pw);
  });

  it('inverts locks into permission bits and forces AES-256', async () => {
    const out = await ProtectionService.protect({
      bytes: new Uint8Array([9]),
      userPassword: 'open-sesame',
      ownerPassword: 'master',
      locks: { printing: true, copying: false, modifying: true },
    });
    expect(out[0]).toBe(37); // '%'

    const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt');
    expect(vi.mocked(encryptPDF)).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'open-sesame',
      expect.objectContaining({
        algorithm: 'AES-256',
        ownerPassword: 'master',
        allowPrinting: false,
        allowCopying: true,
        allowModifying: false,
        allowAssembly: false,
      }),
    );
  });

  it('passes through a fresh copy of the bytes (never mutates caller buffer)', async () => {
    const bytes = new Uint8Array([7, 7, 7]);
    await ProtectionService.protect({
      bytes,
      userPassword: '',
      ownerPassword: '',
      locks: { printing: false, copying: false, modifying: false },
    });
    const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt');
    const passed = vi.mocked(encryptPDF).mock.calls[0][0];
    expect(passed).not.toBe(bytes);
  });
});
