'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, FileCode2, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';

export interface QrGenToolViewProps {
  onBack: () => void;
}

const ECC_LEVELS = [
  { key: 'L', label: 'L', hint: '~7% recovery' },
  { key: 'M', label: 'M', hint: '~15% · best default' },
  { key: 'Q', label: 'Q', hint: '~25% recovery' },
  { key: 'H', label: 'H', hint: '~30% · toughest' },
] as const;
type EccKey = (typeof ECC_LEVELS)[number]['key'];

/**
 * QR Code Generator — live preview, size/margin/ECC/color controls,
 * PNG + SVG download. Encoding runs on-device via the qrcode lib.
 */
export const QrGenToolView: React.FC<QrGenToolViewProps> = ({ onBack }) => {
  const [text, setText] = useState('https://print-optimizer.vercel.app');
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [ecc, setEcc] = useState<EccKey>('M');
  const [dark, setDark] = useState('#0f172a');
  const [light, setLight] = useState('#ffffff');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(async () => {
    const value = text.trim();
    if (!value) {
      setSvg(null);
      setError(null);
      return;
    }
    const opts = {
      width: size,
      margin,
      errorCorrectionLevel: ecc,
      color: { dark, light },
    } as const;
    try {
      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, value, opts);
      }
      setSvg(await QRCode.toString(value, { ...opts, type: 'svg' }));
      setError(null);
    } catch {
      setSvg(null);
      setError('This text is too long for one QR code — shorten it or lower error correction.');
    }
  }, [text, size, margin, ecc, dark, light]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void render();
    }, 250);
    return () => window.clearTimeout(t);
  }, [render]);

  const downloadPng = () => {
    if (!canvasRef.current || !text.trim()) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = 'qr-code.png';
    a.click();
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'qr-code.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-surface-2/70 bg-bg/90 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to tools"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-elevated/60 bg-surface/80 text-ink transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-soft"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[15px] font-bold text-ink">QR Code Generator</h1>
          <p className="truncate text-[11px] text-ink-faint">Links · text · Wi-Fi · PNG & SVG · on-device</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold tabular-nums text-accent-soft">
          {text.trim().length} ch
        </span>
      </header>

      {/* Input */}
      <section aria-label="QR content" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <label htmlFor="qr-text" className="text-sm font-bold text-ink">
          Text or link to encode
        </label>
        <textarea
          id="qr-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="https://example.com or any text…"
          className="mt-2 w-full resize-y rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {error && (
          <p role="alert" className="mt-2 rounded-xl border border-danger/30 bg-danger-faint/50 px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-ink-muted">Preview updates live — nothing leaves your device.</p>
          {text && (
            <button
              type="button"
              onClick={() => setText('')}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-ink-muted transition hover:bg-elevated hover:text-ink"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>
      </section>

      {/* Preview */}
      <section aria-label="QR preview" className="flex flex-col items-center gap-3 rounded-2xl border border-surface-2 bg-surface/90 p-4 shadow-lg sm:p-5">
        {svg ? (
          <>
            <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border border-elevated/60 bg-white p-3 shadow-inner">
              <canvas ref={canvasRef} aria-label="QR code preview" className="h-auto w-full" />
            </div>
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={downloadPng}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary-strong px-4 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary hover:shadow-lg active:scale-[0.98]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                PNG
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-elevated bg-surface px-4 text-sm font-bold text-ink shadow-sm transition hover:bg-surface-2 active:scale-[0.98]"
              >
                <FileCode2 className="h-4 w-4" aria-hidden="true" />
                SVG
              </button>
            </div>
          </>
        ) : (
          <p className="py-10 text-sm text-ink-muted">Type something above to see your QR code.</p>
        )}
      </section>

      {/* Options */}
      <section aria-label="QR options" className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">Size</span>
            <span className="rounded-md border border-primary/30 bg-primary/20 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-soft">
              {size}px
            </span>
          </div>
          <input
            type="range"
            min={128}
            max={1024}
            step={32}
            value={size}
            aria-label="QR size in pixels"
            onChange={(e) => setSize(Number(e.target.value))}
            className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-elevated py-2
              [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-soft
              [&::-webkit-slider-thumb]:bg-primary-strong [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-soft [&::-moz-range-thumb]:bg-primary-strong"
            style={{ background: `linear-gradient(to right, var(--color-primary) ${((size - 128) / 896) * 100}%, var(--color-elevated) ${((size - 128) / 896) * 100}%)` }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink">Quiet margin</span>
            <span className="rounded-md border border-primary/30 bg-primary/20 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-soft">
              {margin}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={8}
            step={1}
            value={margin}
            aria-label="Quiet zone margin in modules"
            onChange={(e) => setMargin(Number(e.target.value))}
            className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-elevated py-2
              [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-soft
              [&::-webkit-slider-thumb]:bg-primary-strong [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-soft [&::-moz-range-thumb]:bg-primary-strong"
            style={{ background: `linear-gradient(to right, var(--color-primary) ${(margin / 8) * 100}%, var(--color-elevated) ${(margin / 8) * 100}%)` }}
          />
        </div>

        <div className="border-t border-surface-2 pt-3">
          <span className="text-sm font-bold text-ink">Error correction</span>
          <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Error correction level">
            {ECC_LEVELS.map((lvl) => (
              <button
                key={lvl.key}
                type="button"
                onClick={() => setEcc(lvl.key)}
                aria-pressed={ecc === lvl.key}
                className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border px-1 transition-all active:scale-[0.97] ${
                  ecc === lvl.key
                    ? 'border-primary/40 bg-primary/15 text-primary-soft shadow-sm'
                    : 'border-elevated/60 bg-surface-2/60 text-ink-muted hover:bg-elevated'
                }`}
              >
                <span className="text-sm font-extrabold">{lvl.label}</span>
                <span className="text-[10px] leading-tight text-ink-faint">{lvl.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-2 pt-3">
          <label className="flex items-center gap-2.5 text-sm font-bold text-ink" htmlFor="qr-dark">
            <input
              id="qr-dark"
              type="color"
              value={dark}
              onChange={(e) => setDark(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-elevated bg-surface-2 p-1"
            />
            Modules
          </label>
          <label className="flex items-center gap-2.5 text-sm font-bold text-ink" htmlFor="qr-light">
            Background
            <input
              id="qr-light"
              type="color"
              value={light}
              onChange={(e) => setLight(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-elevated bg-surface-2 p-1"
            />
          </label>
        </div>
      </section>
    </div>
  );
};
