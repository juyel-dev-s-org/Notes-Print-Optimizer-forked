import type { FaqItem } from '@/lib/content/faqs';

/**
 * Zero-JS FAQ accordion — native <details>/<summary> gives keyboard focus,
 * screen-reader semantics and progressive enhancement for free (works before
 * hydration; this is a static export). Smooth height animation is a
 * CSS-only progressive enhancement (see globals.css ::details-content).
 * Premium feel: card container, hairline dividers, rotating chevron,
 * token-driven theming for dark/light.
 *
 * Exclusive open: all items share the same `name` group, so opening one
 * closes the others (native HTML behavior — Chrome 120+/Safari 17.2+/FF 130+).
 * Older browsers gracefully fall back to independent items.
 */
export function FaqAccordion({ faqs, headingId = 'faq-heading', groupName = 'faq' }: { faqs: FaqItem[]; headingId?: string; groupName?: string }) {
  if (faqs.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-surface-2/70 bg-surface/50 p-5 text-sm md:p-6"
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-base font-bold text-ink">
          Frequently asked questions
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {faqs.length} Q&amp;A
        </span>
      </div>

      <div className="divide-y divide-surface-2/70">
        {faqs.map((item) => (
          <details key={item.q} name={groupName} className="faq-item group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 font-semibold text-ink transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
              <h3 className="text-sm font-semibold">{item.q}</h3>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 shrink-0 text-ink-faint transition-transform duration-300 group-open:rotate-180"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </summary>
            <p className="pb-4 pr-8 leading-relaxed text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
