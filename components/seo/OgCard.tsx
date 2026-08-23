import { ImageResponse } from 'next/og';
import type { ToolDefinition } from '@/lib/tools/registry';

/**
 * Shared branded Open Graph card (1200x630) — used by the file-convention
 * image routes (app/opengraph-image.tsx and app/tools/[slug]/opengraph-image.tsx).
 * Rendered ONCE at build time by static export; zero runtime cost.
 *
 * Note: satori supports a flexbox subset only. Default font ships with
 * next/og — no network font fetches, so CI builds stay hermetic.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const GRADIENT = 'linear-gradient(135deg, #243BFF 0%, #5B35FF 55%, #A12CFF 100%)';

function Card({ eyebrow, title }: { eyebrow: string; title: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundImage: GRADIENT,
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        {/* soft glow blob */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: '#ffffff',
            opacity: 0.1,
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              color: '#5B35FF',
              fontWeight: 700,
            }}
          >
            P
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              letterSpacing: 6,
              fontWeight: 600,
              opacity: 0.92,
            }}
          >
            PRINT OPTIMIZER
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: title.length > 44 ? 58 : 68,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 1020,
        }}
        >
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 28, opacity: 0.85 }}>{eyebrow}</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 26,
              fontWeight: 600,
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 999,
              padding: '14px 32px',
            }}
          >
            100% On-device
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

/** Home/brand card. */
export function renderBrandOg() {
  return Card({ eyebrow: 'Every PDF, print-perfect — free, private, offline', title: 'Every PDF,\nPrint-Perfect' });
}

/** Per-tool card from registry SEO copy. */
export function renderToolOg(tool: ToolDefinition) {
  return Card({ eyebrow: 'Free · No sign-up · Works offline', title: tool.seoTitle.replace(/ — .*$/, '') });
}
