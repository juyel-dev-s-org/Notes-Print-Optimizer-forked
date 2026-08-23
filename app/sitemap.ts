import type { MetadataRoute } from 'next';
import { TOOL_REGISTRY } from '@/lib/tools/registry';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-static';

/** Generated sitemap — derives every URL from the central site config and
 * the registry route contract. Never hand-edit; add tools via the registry. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastMod = new Date();

  return [
    { url: absoluteUrl('/'), lastModified: lastMod, changeFrequency: 'weekly', priority: 1 },
    ...TOOL_REGISTRY.map((tool) => ({
      url: absoluteUrl(`/tools/${tool.slug}/`),
      lastModified: lastMod,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    { url: absoluteUrl('/offline/'), lastModified: lastMod, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
