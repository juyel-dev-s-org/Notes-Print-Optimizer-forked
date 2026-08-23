import { getToolBySlug, getAllToolSlugs } from '@/lib/tools/registry';
import { renderToolOg } from '@/components/seo/OgCard';

export const dynamic = 'force-static';
export const dynamicParams = false;
export const alt = 'Print Optimizer tool';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return getAllToolSlugs().map((slug) => ({ slug }));
}

export default async function ToolOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  return renderToolOg(tool ?? { seoTitle: 'Print Optimizer' } as never);
}
