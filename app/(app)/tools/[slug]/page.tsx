import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TOOL_REGISTRY, getAllToolSlugs, getToolBySlug } from '@/lib/tools/registry';
import { absoluteUrl } from '@/lib/site';
import { JsonLd } from '@/components/seo/JsonLd';

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
      images: [{ url: absoluteUrl('/icon-512-v2.png'), width: 512, height: 512, alt: tool.title }],
    },
    twitter: {
      card: 'summary',
      title: tool.seoTitle,
      description: tool.seoDescription,
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

  const related = TOOL_REGISTRY.filter((t) => t.id !== tool.id).slice(0, 3);

  return (
    <section aria-labelledby="tool-seo-title" className="mt-2 flex flex-col gap-3 rounded-2xl border border-surface-2/70 bg-surface/50 p-5 text-sm leading-relaxed text-ink-muted md:p-6">
      <h2 id="tool-seo-title" className="text-base font-bold text-ink">{tool.seoTitle}</h2>
      <p>{tool.seoDescription}</p>

      <ul className="flex flex-wrap gap-2" aria-label="Key features">
        {tool.chips.map((chip) => (
          <li key={chip} className="rounded-full border border-elevated bg-surface px-3 py-1 text-xs font-semibold text-ink">
            {chip}
          </li>
        ))}
      </ul>

      <p className="text-xs">
        Print Optimizer runs entirely on your device — files are processed locally in your
        browser and are never uploaded to any server. Free to use, no sign-up.
      </p>

      <nav aria-label="Related tools" className="border-t border-surface-2 pt-3">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Related tools</h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-primary-soft">
          {related.map((r) => (
            <li key={r.id}>
              <Link href={`/tools/${r.slug}/`} prefetch={false} className="hover:underline">
                {r.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

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
        ]}
      />
    </section>
  );
}
