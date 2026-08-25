'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ClipboardPaste,
  Copy,
  ExternalLink,
  History,
  Image as ImageIcon,
  Scan,
  Share2,
  Trash2,
  Zap,
  ZapOff,
} from 'lucide-react';

const HISTORY_KEY = 'qr-scan-history-v1';
const MAX_HISTORY = 20;

type CameraInfo = { id: string; label: string };

function detectKind(text: string): { label: string; action?: string } {
  const t = text.trim();
  if (/^WIFI:/.test(t)) return { label: 'Wi-Fi', action: 'Wi-Fi config' };
  if (/^https?:\/\//i.test(t)) return { label: 'Link', action: 'Open' };
  if (/^mailto:/i.test(t)) return { label: 'Email', action: 'Email' };
  if (/^tel:/i.test(t)) return { label: 'Phone', action: 'Call' };
  if (/^\d{7,}$/.test(t.replace(/[^\d]/g, '')) && t.length < 20) return { label: 'Phone?' };
  return { label: 'Text', action: 'Copy' };
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string').slice(0, MAX_HISTORY);
  } catch {}
  return [];
}

/**
 * QR Scanner — camera (html5-qrcode lazy) + file/paste + torch + history.
 * 100% on-device, lazy-loaded so Generate stays light.
 */
export const QrScannerView: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const html5Ref = useRef<InstanceType<(typeof import('html5-qrcode'))['Html5Qrcode']> | null>(null);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // load history once
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const persistHistory = useCallback((next: string[]) => {
    setHistory(next);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const onDecoded = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setCurrent(trimmed);
      setError(null);
      // haptics
      try {
        if ('vibrate' in navigator) navigator.vibrate(60);
      } catch {}
      // history dedup: newest first
      setHistory((prev) => {
        const dedup = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, MAX_HISTORY);
        try {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(dedup));
        } catch {}
        return dedup;
      });
    },
    []
  );

  const enumerateCameras = useCallback(async (Html5QrcodeCtor: typeof import('html5-qrcode').Html5Qrcode) => {
    try {
      const cams = await Html5QrcodeCtor.getCameras();
      const mapped: CameraInfo[] = cams.map((c) => ({ id: c.id, label: c.label || c.id }));
      setCameras(mapped);
      if (mapped.length && !selectedId) setSelectedId(mapped[0].id);
      return mapped;
    } catch {
      setCameras([]);
      return [];
    }
  }, [selectedId]);

  const stop = useCallback(async () => {
    setScanning(false);
    setTorchOn(false);
    setTorchSupported(false);
    if (html5Ref.current) {
      try {
        const state = html5Ref.current.getState();
        // 2 = SCANNING
        if (state === 2) await html5Ref.current.stop();
      } catch {}
      try {
        html5Ref.current.clear();
      } catch {}
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!mountRef.current) return;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      // init container
      const id = 'qr-reader';
      // ensure container exists
      if (!document.getElementById(id)) {
        // mountRef holds the container; Html5Qrcode needs id string
      }
      const inst = new Html5Qrcode(id);
      html5Ref.current = inst as unknown as InstanceType<(typeof import('html5-qrcode'))['Html5Qrcode']>;
      const cams = await enumerateCameras(Html5Qrcode);
      const camId = selectedId || cams[0]?.id;
      if (!camId) {
        setError('No camera found. Use image upload below — nothing leaves your device.');
        return;
      }
      await inst.start(
        camId,
        { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
        (decoded) => onDecoded(decoded),
        () => {}
      );
      setScanning(true);
      // torch detection: inspect track capabilities
      try {
        // Html5Qrcode exposes getRunningTrackCapabilities but not in types for all versions
        const caps = (inst as unknown as { getRunningTrackCapabilities?: () => MediaTrackCapabilities }).getRunningTrackCapabilities?.();
        if (caps && 'torch' in caps) setTorchSupported(true);
        else {
          // fallback: query video element's stream
          const video = document.querySelector(`#${id} video`) as HTMLVideoElement | null;
          const track = (video?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
          const tc = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean } | undefined;
          if (tc && 'torch' in tc) setTorchSupported(true);
        }
      } catch {}
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/NotAllowedError|Permission denied/i.test(msg)) setError('Camera blocked — allow access in your browser, or scan an image below.');
      else if (/NotFoundError|No camera/i.test(msg)) setError('No camera detected. Use image upload below.');
      else setError(`Couldn\u2019t start camera — ${msg.slice(0, 120)}`);
      setScanning(false);
    }
  }, [selectedId, enumerateCameras, onDecoded]);

  const toggleTorch = useCallback(async () => {
    if (!torchSupported || !html5Ref.current) return;
    try {
      const inst = html5Ref.current as unknown as {
        getRunningTrackSettings?: () => MediaTrackSettings;
        applyVideoConstraints?: (c: MediaTrackConstraints) => Promise<void>;
      };
      // html5-qrcode helper; fallback to track applyConstraints
      if (inst.applyVideoConstraints) {
        await inst.applyVideoConstraints({ advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet] });
      } else {
        const video = document.querySelector('#qr-reader video') as HTMLVideoElement | null;
        const track = (video?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
        await track?.applyConstraints({ advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet] });
      }
      setTorchOn((v) => !v);
    } catch {
      setError('Torch not supported on this camera.');
    }
  }, [torchOn, torchSupported]);

  // scan file via html5-qrcode
  const scanFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        // use a temporary instance with dummy id
        const inst = new Html5Qrcode('qr-file-tmp');
        const decoded = await inst.scanFile(file, true);
        onDecoded(decoded);
      } catch {
        setError('Couldn\u2019t read a QR from that image — try a clearer, uncropped photo.');
      }
    },
    [onDecoded]
  );

  // paste handler
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            await scanFile(f);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste as unknown as EventListener);
    return () => window.removeEventListener('paste', onPaste as unknown as EventListener);
  }, [scanFile]);

  // cleanup on unmount
  useEffect(() => () => void stop(), [stop]);

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const kind = current ? detectKind(current) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Camera region */}
      <section aria-label="Scan from camera" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
            <Camera className="h-4 w-4 text-primary-soft" aria-hidden="true" /> Camera
          </span>
          <span className="flex items-center gap-1.5">
            {torchSupported && scanning && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-pressed={torchOn}
                className={`inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-bold transition ${
                  torchOn ? 'border-warning/40 bg-warning/15 text-warning' : 'border-elevated bg-surface-2/60 text-ink-muted hover:bg-elevated'
                }`}
              >
                {torchOn ? <Zap className="h-3.5 w-3.5" aria-hidden="true" /> : <ZapOff className="h-3.5 w-3.5" aria-hidden="true" />}
                {torchOn ? 'Torch on' : 'Torch'}
              </button>
            )}
            {scanning ? (
              <button
                type="button"
                onClick={stop}
                className="h-8 rounded-full border border-elevated bg-surface px-3 text-xs font-bold text-ink-muted hover:bg-surface-2"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={start}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-primary-strong px-3 text-xs font-bold text-white shadow-sm hover:bg-primary"
              >
                <Scan className="h-3.5 w-3.5" aria-hidden="true" /> Start
              </button>
            )}
          </span>
        </div>

        {cameras.length > 1 && (
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-ink-muted">Camera</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={scanning}
              className="mt-1 w-full rounded-xl border border-elevated bg-surface-2/60 px-3 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div
          ref={mountRef}
          id="qr-reader"
          className={`relative mt-3 overflow-hidden rounded-2xl border bg-black ${scanning ? 'border-primary/30' : 'border-elevated/60'}`}
          style={{ minHeight: scanning ? 280 : 0 }}
          aria-live="polite"
        >
          {!scanning && (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5">
                <Scan className="h-6 w-6 text-white/70" aria-hidden="true" />
              </span>
              <p className="text-sm font-bold text-white/80">Camera is off</p>
              <p className="max-w-[28ch] text-xs leading-relaxed text-white/60">Tap Start — grant camera access once, everything decodes on-device.</p>
            </div>
          )}
        </div>
        {/* hidden helper for file scan */}
        <div id="qr-file-tmp" className="hidden" aria-hidden="true" />

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
            {error}
          </p>
        )}
      </section>

      {/* File / drag / paste */}
      <section
        aria-label="Scan from image"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) await scanFile(f);
        }}
        className={`rounded-2xl border bg-surface/90 p-3.5 shadow-lg sm:p-4 ${dragOver ? 'border-primary/40 bg-primary/5' : 'border-surface-2'}`}
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
          <ImageIcon className="h-4 w-4 text-primary-soft" aria-hidden="true" /> Image
        </span>
        <p className="mt-1 text-xs text-ink-muted">Upload, drag & drop, or paste (Ctrl+V) a photo/screenshot containing a QR code.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-strong px-4 text-sm font-bold text-white shadow-sm hover:bg-primary"
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" /> Choose image
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (t) onDecoded(t);
              } catch {}
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-elevated bg-surface px-4 text-sm font-bold text-ink-muted hover:bg-surface-2"
          >
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Paste text
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await scanFile(f);
            e.target.value = '';
          }}
        />
        <p className="mt-2 text-[11px] text-ink-faint">On-device only — images never leave your browser.</p>
      </section>

      {/* Result */}
      {current && (
        <section aria-label="Scan result" className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 shadow-lg sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-strong px-2.5 py-1 text-xs font-bold text-white">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Decoded
            </span>
            <span className="rounded-full border border-elevated bg-surface px-2 py-0.5 text-xs font-bold text-ink-muted">{kind?.label}</span>
          </div>
          <output className="mt-2 block break-words rounded-xl border border-elevated/60 bg-surface px-3 py-3 font-mono text-sm text-ink select-all">
            {current}
          </output>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(current)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-strong px-4 text-sm font-bold text-white shadow-sm hover:bg-primary"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {kind?.label === 'Link' && (
              <a
                href={current}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-elevated bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-2"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Open
              </a>
            )}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={() => (navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share({ text: current }).catch(() => {})}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-elevated bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-2"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" /> Share
              </button>
            )}
            <button
              type="button"
              onClick={() => setCurrent(null)}
              className="ml-auto h-10 rounded-full border border-elevated bg-surface px-4 text-sm font-bold text-ink-muted hover:bg-surface-2"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* History */}
      <section aria-label="Scan history" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink">
            <History className="h-4 w-4 text-primary-soft" aria-hidden="true" /> History
          </span>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => persistHistory([])}
              className="inline-flex items-center gap-1 rounded-full border border-elevated bg-surface px-2.5 py-1 text-xs font-bold text-ink-muted hover:bg-surface-2"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No scans yet — results appear here for quick re-copy.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {history.map((h) => (
              <li key={h} className="flex items-center gap-2 rounded-xl border border-elevated/60 bg-surface-2/40 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{h}</span>
                <button
                  type="button"
                  onClick={() => copy(h)}
                  aria-label={`Copy ${h.slice(0, 24)}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-elevated bg-surface text-ink-muted hover:bg-elevated hover:text-ink"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
