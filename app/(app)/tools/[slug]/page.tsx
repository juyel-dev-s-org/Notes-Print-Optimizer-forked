import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TOOL_REGISTRY, getAllToolSlugs, getToolBySlug } from '@/lib/tools/registry';
import { absoluteUrl, ogImageUrl } from '@/lib/site';
import { buildFaqJsonLd, getFaqsForSlug } from '@/lib/content/faqs';
import { FaqAccordion } from '@/components/seo/FaqAccordion';
import { JsonLd } from '@/components/seo/JsonLd';
import { ToolSeoShell } from '@/components/seo/ToolSeoShell';

/**
 * Public tool route — the URL contract lives in the registry
 * (lib/tools/registry.ts). Every slug is prerendered at build time;
 * unknown slugs are impossible by construction (dynamicParams = false).
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllToolSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};

  const canonical = absoluteUrl(`/tools/${tool.slug}/`);
  return {
    title: tool.seoTitle,
    description: tool.seoDescription,
    alternates: { canonical },
    openGraph: {
      title: tool.seoTitle,
      description: tool.seoDescription,
      url: canonical,
      siteName: 'Print Optimizer',
      type: 'website',
      images: [
        {
          url: ogImageUrl(`${tool.slug}.png`),
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: tool.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: tool.seoTitle,
      description: tool.seoDescription,
      images: [
        {
          url: ogImageUrl(`${tool.slug}.png`),
          alt: tool.title,
        },
      ],
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  // Related tools: same category first (registry order), then the rest — top 4.
  const related = [
    ...TOOL_REGISTRY.filter((t) => t.id !== tool.id && t.category === tool.category),
    ...TOOL_REGISTRY.filter((t) => t.id !== tool.id && t.category !== tool.category),
  ].slice(0, 4);
  const faqs = getFaqsForSlug(tool.slug);

  return (
    <>
      <ToolSeoShell>
        <div className="mt-2 flex flex-col gap-4">
        <section
          aria-labelledby="tool-seo-title"
          className="text-sm leading-relaxed text-ink-muted"
        >
          <h2 id="tool-seo-title" className="sr-only">
            {tool.seoTitle}
          </h2>

          <FaqAccordion faqs={faqs} headingId="tool-faq-heading" />

          {/* Crawler-facing summary — collapsed, quiet, below the workflow.
              Content stays human-accessible (tap to open) so nothing is
              hidden from users that Google sees. */}
          <details className="group mt-4 border-t border-surface-2/70 pt-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1.5 text-[11px] font-semibold tracking-wide text-ink-faint transition-colors hover:text-ink-muted [&::-webkit-details-marker]:hidden">
              <span>About this tool</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3 shrink-0 text-ink-faint transition-transform duration-300 group-open:rotate-180"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </summary>
            <p className="pb-2 pt-0.5 text-xs leading-relaxed text-ink-faint">
              {tool.seoDescription} Print Optimizer runs entirely on your device — files are processed locally in
              your browser and are never uploaded to any server. Free to use, no sign-up.
            </p>
          </details>
        </section>

        <nav aria-label="Related tools" className="rounded-2xl border border-surface-2/70 bg-surface/50 p-3.5 sm:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Related tools
            </h3>
            <Link href="/" prefetch={false} className="shrink-0 text-xs font-semibold text-primary-soft hover:underline">
              View all {TOOL_REGISTRY.length}
            </Link>
          </div>
          {/* Flat chip rail — one thumb-swipe on phones, zero tall cards */}
          <ul className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
            {related.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.id} className="snap-start">
                  <Link
                    href={`/tools/${r.slug}/`}
                    prefetch={false}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-elevated bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary-soft active:scale-[0.97]"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary-soft" aria-hidden="true" />
                    {r.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        </div>
      </ToolSeoShell>

      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: `${tool.title} — Print Optimizer`,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any (web browser)',
            url: absoluteUrl(`/tools/${tool.slug}/`),
            description: tool.seoDescription,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Print Optimizer', item: absoluteUrl('/') },
              { '@type': 'ListItem', position: 2, name: tool.title, item: absoluteUrl(`/tools/${tool.slug}/`) },
            ],
          },
          ...(faqs.length > 0 ? [buildFaqJsonLd(absoluteUrl(`/tools/${tool.slug}/`), faqs)] : []),
        ]}
      />
    </>
  );
}
