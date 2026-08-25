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
          className="rounded-2xl border border-surface-2/70 bg-surface/50 p-5 text-sm leading-relaxed text-ink-muted md:p-6"
        >
          <h2 id="tool-seo-title" className="text-base font-bold text-ink">
            {tool.seoTitle}
          </h2>
          <p className="mt-2">{tool.description}</p>

          <details className="group mt-3 rounded-xl border border-elevated/60 bg-surface/60 open:bg-surface/80">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold tracking-wide text-ink hover:text-primary-soft [&::-webkit-details-marker]:hidden">
              <span>How it works</span>
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
            <p className="px-3.5 pb-3.5 pt-1 text-sm leading-relaxed text-ink-muted">{tool.seoDescription}</p>
          </details>

          <p className="mt-3 text-xs">
            Print Optimizer runs entirely on your device — files are processed locally in your browser and are never
            uploaded to any server. Free to use, no sign-up.
          </p>
        </section>

        <FaqAccordion faqs={faqs} headingId="tool-faq-heading" />

        <nav
          aria-label="Related tools"
          className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning-faint/60 via-surface/60 to-danger-faint/30 p-5 shadow-card"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-warning-strong" />
              Related tools
            </h3>
            <Link href="/" prefetch={false} className="text-xs font-semibold text-primary-soft hover:underline">
              View all {TOOL_REGISTRY.length}
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {related.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.id}>
                  <Link
                    href={`/tools/${r.slug}/`}
                    prefetch={false}
                    className="flex items-center gap-3 rounded-xl border border-elevated bg-surface px-3 py-3 text-left transition-colors hover:border-primary/30 hover:bg-surface-2/80"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                      <Icon className="h-4 w-4 text-primary-soft" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-ink">{r.title}</span>
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 shrink-0 text-ink-faint"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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
