/**
 * useProtectWorkflow — hook driving the Protect PDF tool.
 * Pure reducer + lazy encryption service; progress stages are cosmetic
 * (single-shot encrypt) but honest labels about what AES-256 does.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { isLikelyPdfFile, UploadService } from '@/lib/services/UploadService';
import { ExportService } from '@/lib/services/ExportService';
import { ProtectionService } from './protectionService';
import {
  INITIAL_PROTECT_STATE,
  protectReducer,
  sanitizeBaseName,
} from './protectReducer';

const ENCRYPT_STAGES: Array<{ pct: number; label: string }> = [
  { pct: 12, label: 'Reading document…' },
  { pct: 38, label: 'Deriving AES-256 key…' },
  { pct: 66, label: 'Encrypting content streams…' },
  { pct: 88, label: 'Writing security dictionary…' },
];

export function useProtectWorkflow() {
  const [state, dispatch] = useReducer(protectReducer, INITIAL_PROTECT_STATE);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    if (state.isBusy) return;
    const file = files[0];
    if (!file) return;
    try {
      if (!(await isLikelyPdfFile(file))) {
        dispatch({ type: 'PROTECT_ERROR', error: `"${file.name}" is not a PDF file.` });
        return;
      }
      const [item] = await UploadService.readFiles([file]);
      dispatch({
        type: 'SET_FILE',
        source: {
          name: item.name,
          baseName: item.name.replace(/\.pdf$/i, ''),
          sizeMB: item.sizeMB,
          bytes: new Uint8Array(item.arrayBuffer.slice(0)),
        },
      });
    } catch {
      dispatch({ type: 'PROTECT_ERROR', error: 'Failed to read the selected file.' });
    }
  }, [state.isBusy]);

  const canProtect =
    !!state.source && !state.isBusy &&
    (state.userPassword.length > 0 ||
      state.locks.printing || state.locks.copying || state.locks.modifying);

  const handleProtect = useCallback(async () => {
    if (!canProtect || !state.source) return;
    dispatch({ type: 'PROTECT_START', progress: ENCRYPT_STAGES[0] });

    let stage = 0;
    stageTimerRef.current = setInterval(() => {
      stage = Math.min(stage + 1, ENCRYPT_STAGES.length - 1);
      dispatch({ type: 'PROTECT_PROGRESS', progress: ENCRYPT_STAGES[stage] });
    }, 220);

    try {
      const ownerPassword = state.ownerPassword || ProtectionService.generateOwnerPassword();
      const out = await ProtectionService.protect({
        bytes: state.source.bytes.slice(0),
        userPassword: state.userPassword,
        ownerPassword,
        locks: state.locks,
      });
      dispatch({ type: 'PROTECT_COMPLETE', blob: new Blob([out as unknown as BlobPart], { type: 'application/pdf' }) });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'AlreadyEncryptedError'
          ? 'This PDF is already password-protected — remove the existing lock first.'
          : 'Encryption failed. The file may be corrupted.';
      dispatch({ type: 'PROTECT_ERROR', error: msg });
    } finally {
      if (stageTimerRef.current) {
        clearInterval(stageTimerRef.current);
        stageTimerRef.current = null;
      }
    }
  }, [canProtect, state.source, state.userPassword, state.ownerPassword, state.locks]);

  const handleDownload = useCallback((baseName: string) => {
    if (!state.resultBlob) return;
    const clean = sanitizeBaseName(baseName) || 'Protected';
    ExportService.downloadBlob(state.resultBlob, `${clean}-PrintReady.pdf`);
  }, [state.resultBlob]);

  const handleSetUserPassword = useCallback((password: string) => {
    dispatch({ type: 'SET_USER_PASSWORD', password });
  }, []);

  const handleSetOwnerPassword = useCallback((password: string) => {
    dispatch({ type: 'SET_OWNER_PASSWORD', password });
  }, []);

  const handleToggleLock = useCallback((key: 'printing' | 'copying' | 'modifying') => {
    dispatch({ type: 'TOGGLE_LOCK', key });
  }, []);

  const handleReset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const handleBackToOptions = useCallback(() => dispatch({ type: 'SET_STEP', step: 'options' }), []);

  const value = useMemo(
    () => ({
      state,
      canProtect,
      handleUpload,
      handleProtect,
      handleDownload,
      handleSetUserPassword,
      handleSetOwnerPassword,
      handleToggleLock,
      handleBackToOptions,
      handleReset,
    }),
    [state, canProtect, handleUpload, handleProtect, handleDownload, handleSetUserPassword, handleSetOwnerPassword, handleToggleLock, handleBackToOptions, handleReset],
  );

  return value;
}

export type ProtectWorkflow = ReturnType<typeof useProtectWorkflow>;
