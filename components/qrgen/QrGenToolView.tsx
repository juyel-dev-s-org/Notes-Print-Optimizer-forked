'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  FileCode2,
  Image as ImageIcon,
  Link2,
  Mail,
  Phone,
  QrCode,
  Sparkles,
  Trash2,
  Wifi,
} from 'lucide-react';
import QRCode from 'qrcode';

export interface QrGenToolViewProps {
  onBack: () => void;
}

type Mode = 'text' | 'url' | 'email' | 'wifi' | 'phone';
type EccKey = 'L' | 'M' | 'Q' | 'H';

const MODES: Array<{ key: Mode; label: string; icon: React.ElementType }> = [
  { key: 'text', label: 'Text', icon: QrCode },
  { key: 'url', label: 'Link', icon: Link2 },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { key: 'phone', label: 'Phone', icon: Phone },
];

const ECC_META: Record<EccKey, { label: string; hint: string; desc: string }> = {
  L: { label: 'L', hint: '~7%', desc: 'Most data, fragile' },
  M: { label: 'M', hint: '~15%', desc: 'Balanced — recommended' },
  Q: { label: 'Q', hint: '~25%', desc: 'Durable' },
  H: { label: 'H', hint: '~30%', desc: 'Toughest, least data' },
};

const EXAMPLES: Record<Mode, string[]> = {
  text: ['Hello — Print Optimizer', 'Scan me 👋 offline forever'],
  url: ['https://print-optimizer.vercel.app', 'https://example.com/menu'],
  email: ['hello@example.com'],
  wifi: ['MyCafe WiFi'],
  phone: ['+8801XXXXXXXXX'],
};

const SIZE_PRESETS = [256, 512, 1024] as const;
const COLOR_SWATCHES = [
  { d: '#0f172a', l: '#ffffff', label: 'Ink' },
  { d: '#1e3a5f', l: '#f0f9ff', label: 'Navy' },
  { d: '#0f766e', l: '#f0fdfa', label: 'Teal' },
  { d: '#7c3aed', l: '#faf5ff', label: 'Violet' },
] as const;

function escapeWifi(s: string): string {
  return s.replace(/([\\;,":])/g, '\\$1');
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * QR Code Generator — production polish.
 * Modes (Text/Link/Email/Wi-Fi/Phone), live preview with capacity/
 * contrast warnings, sticky preview, presets + paste + example chips,
 * size/margin/ECC/colour controls with presets, PNG/SVG/Copy-Image.
 * 100% on-device — qrcode lib.
 */
export const QrGenToolView: React.FC<QrGenToolViewProps> = ({ onBack }) => {
  // mode + per-mode fields
  const [mode, setMode] = useState<Mode>('url');
  const [text, setText] = useState('https://print-optimizer.vercel.app');
  const [emailAddr, setEmailAddr] = useState('hello@example.com');
  const [phoneVal, setPhoneVal] = useState('+880 1XX XXX XXXX');
  const [wifiSsid, setWifiSsid] = useState('MyCafe-WiFi');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiAuth, setWifiAuth] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);

  // qr options
  const [size, setSize] = useState(512);
  const [margin, setMargin] = useState(2);
  const [ecc, setEcc] = useState<EccKey>('M');
  const [dark, setDark] = useState('#0f172a');
  const [light, setLight] = useState('#ffffff');
  const [transparent, setTransparent] = useState(false);

  // render state
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'png' | 'svg' | 'img' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const payload = useMemo(() => {
    switch (mode) {
      case 'text':
        return text.trim();
      case 'url': {
        const v = text.trim();
        if (!v) return '';
        // auto-prepend https if it looks like a naked domain
        if (/^[\w-]+\.[\w.-]+(\/.*)?$/.test(v) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return `https://${v}`;
        return v;
      }
      case 'email': {
        const addr = emailAddr.trim();
        if (!addr) return '';
        return addr.includes('@') ? `mailto:${addr}` : addr;
      }
      case 'phone': {
        const p = phoneVal.trim();
        if (!p) return '';
        const digits = p.replace(/[^\d+]/g, '');
        return digits.startsWith('tel:') ? digits : `tel:${digits}`;
      }
      case 'wifi': {
        const ssid = wifiSsid.trim();
        if (!ssid) return '';
        const pass = wifiAuth === 'nopass' ? '' : escapeWifi(wifiPass);
        return `WIFI:T:${wifiAuth};S:${escapeWifi(ssid)};P:${pass};H:${wifiHidden ? 'true' : 'false'};;`;
      }
    }
  }, [mode, text, emailAddr, phoneVal, wifiSsid, wifiPass, wifiAuth, wifiHidden]);

  const contrast = useMemo(() => {
    if (transparent) return 21;
    const l1 = luminance(dark);
    const l2 = luminance(light);
    const bright = Math.max(l1, l2);
    const dim = Math.min(l1, l2);
    return (bright + 0.05) / (dim + 0.05);
  }, [dark, light, transparent]);

  const lowContrast = contrast < 3;
  const payloadLen = payload.length;
  const nearCapacity = useMemo(() => {
    // rough byte limits per ECC (version 40): L ~2953, M ~2331, Q ~1663, H ~1273
    const limits: Record<EccKey, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };
    return payloadLen > limits[ecc] * 0.85;
  }, [payloadLen, ecc]);

  const render = useCallback(async () => {
    const value = payload;
    if (!value) {
      setSvg(null);
      setError(null);
      // clear canvas to blank
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }
    const bg = transparent ? '#00000000' : light;
    const opts = {
      width: size,
      margin,
      errorCorrectionLevel: ecc,
      color: { dark, light: bg },
    } as const;
    try {
      if (canvasRef.current) {
        // qrcode renders with background; for transparent we clear then draw
        await QRCode.toCanvas(canvasRef.current, value, opts);
        if (transparent) {
          // qrcode ignores alpha — keep as-is; preview checkerboard will show transparency intent
        }
      }
      const svgStr = await QRCode.toString(value, { ...opts, type: 'svg' });
      setSvg(svgStr);
      setError(null);
    } catch {
      setSvg(null);
      setError(
        ecc !== 'L'
          ? 'Too much data for this size/ECC — try Error correction L, or shorten the content.'
          : 'Too much data for a single QR — shorten the text or split into two codes.'
      );
    }
  }, [payload, size, margin, ecc, dark, light, transparent]);

  // debounce text, instant for controls
  useEffect(() => {
    const t = window.setTimeout(() => void render(), mode === 'wifi' ? 0 : 160);
    return () => window.clearTimeout(t);
  }, [render, mode]);

  const filenameBase = `qr-${size}`;

  const downloadPng = () => {
    if (!payload || !canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `${filenameBase}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setCopied('png');
    window.setTimeout(() => setCopied(null), 1500);
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setCopied('svg');
    window.setTimeout(() => setCopied(null), 1500);
  };

  const copyImage = async () => {
    if (!canvasRef.current) return;
    try {
      const blob: Blob | null = await new Promise((res) => canvasRef.current!.toBlob(res, 'image/png'));
      if (!blob) throw new Error('no blob');
      // ClipboardItem may not exist in all contexts
      const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (CI && navigator.clipboard.write) {
        await navigator.clipboard.write([new CI({ 'image/png': blob })]);
      } else {
        // fallback: copy payload text
        await navigator.clipboard.writeText(payload);
      }
      setCopied('img');
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      try {
        await navigator.clipboard.writeText(payload);
        setCopied('img');
        window.setTimeout(() => setCopied(null), 1500);
      } catch {}
    }
  };

  const doPaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) return;
      if (mode === 'email') setEmailAddr(t);
      else if (mode === 'phone') setPhoneVal(t);
      else if (mode === 'wifi') setWifiSsid(t);
      else setText(t);
    } catch {}
  };

  const clearAll = () => {
    if (mode === 'email') setEmailAddr('');
    else if (mode === 'phone') setPhoneVal('');
    else if (mode === 'wifi') {
      setWifiSsid('');
      setWifiPass('');
    } else setText('');
  };

  const fillExample = (ex: string) => {
    if (mode === 'email') setEmailAddr(ex);
    else if (mode === 'phone') setPhoneVal(ex);
    else if (mode === 'wifi') setWifiSsid(ex);
    else setText(ex);
  };

  const hasPayload = payload.length > 0;
  const canDownload = hasPayload && !!svg && !error;

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
          <p className="truncate text-[11px] text-ink-faint">Text · links · email · Wi-Fi & phone — on-device</p>
        </div>
        <span className="hidden items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-bold text-success sm:inline-flex">
          <Eye className="h-3 w-3" aria-hidden="true" /> On-device
        </span>
      </header>

      {/* Mode */}
      <div
        role="tablist"
        aria-label="QR content type"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-surface-2 bg-surface/80 p-1.5 shadow-sm scrollbar-none"
      >
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.key)}
              className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition-all active:scale-[0.98] ${
                active
                  ? 'bg-primary-strong text-white shadow-md shadow-primary/20'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <m.icon className="h-4 w-4" aria-hidden="true" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Two-col: left inputs, right sticky preview + controls on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        {/* Left column */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Input card per mode */}
          <section
            aria-label={
              mode === 'wifi' ? 'Wi-Fi details' : mode === 'email' ? 'Email address' : mode === 'phone' ? 'Phone number' : 'QR content'
            }
            className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4"
          >
            {mode === 'wifi' ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-ink">Wi-Fi network</label>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-soft">WIFI:… scan to join</span>
                </div>
                <label htmlFor="wifi-ssid" className="mt-3 block text-xs font-semibold text-ink-muted">
                  Network name (SSID)
                </label>
                <input
                  id="wifi-ssid"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="MyCafe-WiFi"
                  className="mt-1 w-full rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-ink-muted">Security</span>
                    <select
                      value={wifiAuth}
                      onChange={(e) => setWifiAuth(e.target.value as typeof wifiAuth)}
                      className="mt-1 w-full rounded-xl border border-elevated bg-surface-2/60 px-3 py-2.5 text-sm font-semibold text-ink focus:border-primary/40 focus:outline-none"
                    >
                      <option value="WPA">WPA/WPA2</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">Open</option>
                    </select>
                  </label>
                  <label className="flex flex-col justify-end">
                    <span className="text-xs font-semibold text-ink-muted">Hidden</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={wifiHidden}
                      onClick={() => setWifiHidden((v) => !v)}
                      className={`mt-1 inline-flex h-[42px] items-center justify-between rounded-xl border px-3 text-sm font-bold transition ${
                        wifiHidden ? 'border-primary/40 bg-primary/15 text-primary-soft' : 'border-elevated bg-surface-2/60 text-ink-muted'
                      }`}
                    >
                      {wifiHidden ? 'Yes' : 'No'}
                      <span
                        aria-hidden="true"
                        className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 ${wifiHidden ? 'bg-primary-strong' : 'bg-elevated'}`}
                      >
                        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${wifiHidden ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  </label>
                </div>
                {wifiAuth !== 'nopass' && (
                  <>
                    <label htmlFor="wifi-pass" className="mt-3 block text-xs font-semibold text-ink-muted">
                      Password
                    </label>
                    <input
                      id="wifi-pass"
                      type="password"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1 w-full rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                  iOS & Android camera apps recognise <span className="font-mono font-bold">WIFI:T:…</span> and offer to join instantly.
                </p>
              </>
            ) : mode === 'email' ? (
              <>
                <label htmlFor="qr-email" className="text-sm font-bold text-ink">
                  Email address
                </label>
                <input
                  id="qr-email"
                  type="email"
                  inputMode="email"
                  value={emailAddr}
                  onChange={(e) => setEmailAddr(e.target.value)}
                  placeholder="hello@example.com"
                  className="mt-2 w-full rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 text-sm text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-2 text-xs text-ink-muted">Encodes as <span className="font-mono font-semibold">mailto:</span> — scanner opens the mail app.</p>
              </>
            ) : mode === 'phone' ? (
              <>
                <label htmlFor="qr-phone" className="text-sm font-bold text-ink">
                  Phone number
                </label>
                <input
                  id="qr-phone"
                  type="tel"
                  inputMode="tel"
                  value={phoneVal}
                  onChange={(e) => setPhoneVal(e.target.value)}
                  placeholder="+880 1XX XXX XXXX"
                  className="mt-2 w-full rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="mt-2 text-xs text-ink-muted">Encodes as <span className="font-mono font-semibold">tel:</span> — tap to call.</p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="qr-text" className="text-sm font-bold text-ink">
                    {mode === 'url' ? 'Link to encode' : 'Text to encode'}
                  </label>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums ${
                      nearCapacity ? 'border-warning/40 bg-warning/10 text-warning' : 'border-elevated bg-surface-2/60 text-ink-faint'
                    }`}
                    aria-live="polite"
                  >
                    {payloadLen} ch
                  </span>
                </div>
                <textarea
                  id="qr-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={mode === 'url' ? 2 : 3}
                  placeholder={mode === 'url' ? 'https://example.com  — naked domains get https://' : 'Any text…'}
                  className="mt-2 w-full resize-y rounded-xl border border-elevated bg-surface-2/60 px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {mode === 'url' && payload && !/^https?:\/\//i.test(payload) && payload.includes('.') && (
                  <p className="mt-1.5 text-xs font-medium text-warning">Tip: add https:// for a tappable link on most scanners.</p>
                )}
              </>
            )}

            {/* examples + actions row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Try
              </span>
              {EXAMPLES[mode].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => fillExample(ex)}
                  className="rounded-full border border-elevated bg-surface-2/60 px-2.5 py-1 text-xs font-semibold text-ink-muted transition hover:bg-elevated hover:text-ink active:scale-[0.98]"
                >
                  {ex.length > 28 ? `${ex.slice(0, 28)}…` : ex}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={doPaste}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-elevated bg-surface px-3 text-xs font-bold text-ink-muted transition hover:bg-surface-2 hover:text-ink active:scale-[0.98]"
              >
                <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" /> Paste
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-elevated bg-surface px-3 text-xs font-bold text-ink-muted transition hover:bg-surface-2 hover:text-ink active:scale-[0.98]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear
              </button>
              <span className="ml-auto hidden items-center gap-1 text-xs text-ink-faint sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" /> Nothing leaves your device
              </span>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5"
              >
                <span className="rounded-full bg-warning/20 p-1">
                  <Eye className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-snug text-warning">{error}</p>
                  {ecc !== 'L' && (
                    <button
                      type="button"
                      onClick={() => setEcc('L')}
                      className="mt-1 rounded-full bg-warning px-2.5 py-1 text-xs font-bold text-white"
                    >
                      Switch to L
                    </button>
                  )}
                </div>
              </div>
            )}
            {lowContrast && hasPayload && !error && (
              <p role="status" className="mt-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                Low contrast — scanners may fail. Use darker modules or a lighter background.
              </p>
            )}
          </section>

          {/* Desktop: controls live here on mobile; on lg they move to right column below preview */}
          <div className="flex flex-col gap-4 lg:hidden">
            <Controls
              size={size}
              setSize={setSize}
              margin={margin}
              setMargin={setMargin}
              ecc={ecc}
              setEcc={setEcc}
              dark={dark}
              setDark={setDark}
              light={light}
              setLight={setLight}
              transparent={transparent}
              setTransparent={setTransparent}
            />
          </div>
        </div>

        {/* Right column — sticky preview + controls */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto lg:pr-1">
          {/* Preview */}
          <section aria-label="QR preview" className="rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink">Preview</span>
              <span className="flex items-center gap-2">
                <span className="rounded-full border border-elevated bg-surface-2/60 px-2 py-0.5 text-xs font-bold tabular-nums text-ink-muted">
                  {size} × {size}
                </span>
                <span className="hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary-soft sm:inline-flex">
                  <ImageIcon className="h-3 w-3" aria-hidden="true" /> PNG & SVG
                </span>
              </span>
            </div>

            <div
              className={`relative mt-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border p-3 sm:p-4 ${
                transparent
                  ? 'border-dashed border-elevated/60 bg-[radial-gradient(circle_at_1px_1px,theme(colors.elevated)_1px,transparent_0)] bg-[length:16px_16px] bg-surface-2/40'
                  : 'border-elevated/60 bg-white shadow-inner'
              }`}
            >
              {/* canvas always mounted — avoids ref race */}
              <canvas
                ref={canvasRef}
                width={size}
                height={size}
                aria-label={hasPayload ? `QR code for ${payload.slice(0, 48)}` : 'QR preview empty'}
                role="img"
                className={`h-auto w-full max-w-[360px] rounded-xl object-contain ${hasPayload && !error ? 'block' : 'hidden'}`}
                style={{ imageRendering: 'pixelated' as const }}
              />
              {!hasPayload && !error && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-elevated bg-surface-2/60">
                    <QrCode className="h-6 w-6 text-ink-faint" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-bold text-ink-muted">Your QR appears here</p>
                  <p className="max-w-[22ch] text-xs leading-relaxed text-ink-faint">Choose a type above and type something — it renders live, offline.</p>
                </div>
              )}
              {hasPayload && error && (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <p className="text-sm font-bold text-warning">Can’t fit in one QR</p>
                  <p className="max-w-[28ch] text-xs leading-relaxed text-ink-muted">{error}</p>
                </div>
              )}
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1 rounded-full border border-elevated bg-surface-2/60 px-2 py-0.5 font-mono text-[11px]">
                {payloadLen} bytes
              </span>
              <span className="rounded-full border border-elevated bg-surface-2/60 px-2 py-0.5 text-xs font-semibold">ECC {ecc}</span>
              <span className="rounded-full border border-elevated bg-surface-2/60 px-2 py-0.5 text-xs">margin {margin}</span>
              {transparent && <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning">transparent bg</span>}
              {nearCapacity && !error && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">near capacity</span>}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={downloadPng}
                disabled={!canDownload}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary-strong px-3 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
              >
                {copied === 'png' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                PNG
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                disabled={!canDownload}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-elevated bg-surface px-3 text-sm font-bold text-ink shadow-sm transition hover:bg-surface-2 active:scale-[0.98] disabled:opacity-40"
              >
                {copied === 'svg' ? <Check className="h-4 w-4" aria-hidden="true" /> : <FileCode2 className="h-4 w-4" aria-hidden="true" />}
                SVG
              </button>
              <button
                type="button"
                onClick={copyImage}
                disabled={!canDownload}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-elevated bg-surface px-3 text-sm font-bold text-ink shadow-sm transition hover:bg-surface-2 active:scale-[0.98] disabled:opacity-40"
              >
                {copied === 'img' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                Copy
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-ink-faint">PNG {size}×{size} · SVG is resolution-independent · Copy puts image on clipboard</p>
          </section>

          <div className="hidden lg:block">
            <Controls
              size={size}
              setSize={setSize}
              margin={margin}
              setMargin={setMargin}
              ecc={ecc}
              setEcc={setEcc}
              dark={dark}
              setDark={setDark}
              light={light}
              setLight={setLight}
              transparent={transparent}
              setTransparent={setTransparent}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function Controls(props: {
  size: number;
  setSize: (n: number) => void;
  margin: number;
  setMargin: (n: number) => void;
  ecc: EccKey;
  setEcc: (k: EccKey) => void;
  dark: string;
  setDark: (s: string) => void;
  light: string;
  setLight: (s: string) => void;
  transparent: boolean;
  setTransparent: (b: boolean) => void;
}) {
  const { size, setSize, margin, setMargin, ecc, setEcc, dark, setDark, light, setLight, transparent, setTransparent } = props;
  return (
    <section aria-label="QR options" className="flex flex-col gap-4 rounded-2xl border border-surface-2 bg-surface/90 p-3.5 shadow-lg sm:p-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Export size</span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-soft">
            {size}px
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSize(p)}
              aria-pressed={size === p}
              className={`h-8 flex-1 rounded-full border text-xs font-bold transition active:scale-[0.97] ${
                size === p ? 'border-primary/40 bg-primary/15 text-primary-soft' : 'border-elevated bg-surface-2/60 text-ink-muted hover:bg-elevated'
              }`}
            >
              {p}
            </button>
          ))}
          <input
            type="number"
            min={128}
            max={2048}
            step={64}
            value={size}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setSize(Math.min(2048, Math.max(128, Math.round(v / 64) * 64)));
            }}
            aria-label="QR export size in pixels"
            className="h-8 w-20 rounded-full border border-elevated bg-surface-2/60 px-3 text-center text-xs font-bold tabular-nums text-ink focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <input
          type="range"
          min={128}
          max={1024}
          step={32}
          value={Math.min(size, 1024)}
          aria-label="QR size slider"
          onChange={(e) => setSize(Number(e.target.value))}
          className="mt-3 w-full cursor-pointer appearance-none rounded-full bg-elevated py-2
              [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:bg-primary-strong [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary-strong"
        />
        <p className="mt-1 text-xs text-ink-muted">Preview is scaled; download is true {size}×{size}.</p>
      </div>

      <div className="border-t border-surface-2 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Quiet zone</span>
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-soft">
            {margin}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={8}
          step={1}
          value={margin}
          aria-label="Quiet zone margin"
          onChange={(e) => setMargin(Number(e.target.value))}
          className="mt-2 w-full cursor-pointer appearance-none rounded-full bg-elevated py-2
              [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:bg-primary-strong
              [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary-strong"
        />
        <p className="mt-1 text-xs text-ink-muted">White border for scanners — 2 is the default, 0 is tight.</p>
      </div>

      <div className="border-t border-surface-2 pt-3">
        <span className="text-sm font-bold text-ink">Error correction</span>
        <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Error correction level">
          {(['L', 'M', 'Q', 'H'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setEcc(k)}
              aria-pressed={ecc === k}
              className={`flex min-h-[64px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-all active:scale-[0.97] ${
                ecc === k
                  ? 'border-primary/40 bg-primary/15 text-primary-soft shadow-sm'
                  : 'border-elevated/60 bg-surface-2/60 text-ink-muted hover:bg-elevated'
              }`}
            >
              <span className="text-sm font-extrabold">{ECC_META[k].label}</span>
              <span className="text-[11px] font-bold">{ECC_META[k].hint}</span>
              <span className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-ink-faint">{ECC_META[k].desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">Higher survives damage (creases, logos) but holds less data.</p>
      </div>

      <div className="border-t border-surface-2 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">Colours</span>
          <button
            type="button"
            onClick={() => {
              const d = dark;
              setDark(light);
              setLight(d);
            }}
            className="rounded-full border border-elevated bg-surface px-2.5 py-1 text-xs font-bold text-ink-muted hover:bg-surface-2"
          >
            Swap
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COLOR_SWATCHES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setDark(s.d);
                setLight(s.l);
                if (transparent) setTransparent(false);
              }}
              aria-label={`Preset ${s.label}`}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                dark === s.d && light === s.l && !transparent
                  ? 'border-primary/40 bg-primary/10 text-primary-soft'
                  : 'border-elevated bg-surface-2/60 text-ink-muted hover:bg-elevated'
              }`}
            >
              <span className="inline-flex h-3 w-6 overflow-hidden rounded-full border border-black/10">
                <span className="flex-1" style={{ background: s.d }} />
                <span className="flex-1" style={{ background: s.l }} />
              </span>
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setDark('#0f172a');
              setLight('#ffffff');
              setTransparent(false);
            }}
            className="rounded-full border border-elevated bg-surface-2/60 px-2.5 py-1 text-xs font-bold text-ink-muted hover:bg-elevated"
          >
            Reset
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2.5 text-sm font-bold text-ink" htmlFor="qr-dark">
            <input
              id="qr-dark"
              type="color"
              value={dark}
              onChange={(e) => setDark(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded-lg border border-elevated bg-surface-2 p-1"
            />
            Dots
          </label>
          <label className="flex items-center gap-2.5 text-sm font-bold text-ink" htmlFor="qr-light">
            <input
              id="qr-light"
              type="color"
              value={light}
              onChange={(e) => setLight(e.target.value)}
              disabled={transparent}
              className="h-9 w-12 cursor-pointer rounded-lg border border-elevated bg-surface-2 p-1 disabled:opacity-40"
            />
            Paper
          </label>
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} className="rounded border-elevated" />
          Transparent background (for dark pages)
        </label>
      </div>
    </section>
  );
}
