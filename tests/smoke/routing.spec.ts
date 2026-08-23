import { test, expect } from '@playwright/test';

/**
 * Routing contract suite — freezes the deep-linking guarantees:
 * direct navigation, refresh safety, history, crawlable content per route.
 * Runs against the static export served by playwright.config webServer.
 */

const TOOLS = [
  { slug: 'dark-print', name: 'Dark Notes' },
  { slug: 'enhance-light-pdf', name: 'Enhance Light Scans' },
  { slug: 'merge-pdf', name: 'Merge PDF' },
  { slug: 'split-pdf', name: 'Split PDF' },
  { slug: 'protect-pdf', name: 'Password Protect PDF' },
  { slug: 'pdf-to-images', name: 'PDF to Images' },
  { slug: 'image-to-pdf', name: 'Image to PDF' },
];

test.describe('tool routes — direct navigation', () => {
  for (const t of TOOLS) {
    test(`/tools/${t.slug}/ loads standalone with unique SEO content`, async ({ page }) => {
      const resp = await page.goto(`/tools/${t.slug}/`);
      expect(resp?.status()).toBe(200);

      // Unique <title> (template suffix) + canonical + crawlable H2
      await expect(page).toHaveTitle(new RegExp(t.name));
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveAttribute('href', new RegExp(`/tools/${t.slug}/$`));
      await expect(page.locator('#tool-seo-title')).toContainText(t.name);
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('text=404')).toHaveCount(0);
    });
  }
});

test.describe('navigation semantics', () => {
  test('home → tool via card link → back returns home → forward reopens tool', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/tools/merge-pdf/"]');
    await expect(page).toHaveURL(/\/tools\/merge-pdf\/$/);
    await expect(page.locator('#tool-seo-title')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/$/);

    await page.goForward();
    await expect(page).toHaveURL(/\/tools\/merge-pdf\/$/);
    await expect(page.locator('#tool-seo-title')).toBeVisible();
  });

  test('refresh keeps the same tool loaded', async ({ page }) => {
    await page.goto('/tools/split-pdf/');
    await page.reload();
    await expect(page.locator('#tool-seo-title')).toContainText('Split PDF');
  });

  test('unknown route renders the styled 404, not a crash', async ({ page }) => {
    const resp = await page.goto('/tools/not-a-tool/');
    expect(resp?.status()).toBe(404);
    await expect(page.locator('text=404 - Page Not Found')).toBeVisible();
  });

  test('sitemap lists every tool route', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    for (const t of TOOLS) {
      expect(xml).toContain(`/tools/${t.slug}/`);
    }
    expect(xml).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
  });

  test('robots.txt points to the generated sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('Sitemap:');
  });
});
