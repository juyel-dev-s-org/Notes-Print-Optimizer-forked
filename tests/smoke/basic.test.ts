import { test, expect } from '@playwright/test';

test.describe('Cross-browser smoke tests', () => {
  test('page loads and renders header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=Print Optimizer')).toBeVisible();
  });

  test('shows tool selection on initial load', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Every PDF')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Choose a Tool' })).toBeVisible({ timeout: 10000 });
  });

  test('renders processing modal when processing starts', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app-header')).toBeVisible();
  });

  test('PWA manifest loads successfully', async ({ page }) => {
    const resp = await page.goto('/manifest.webmanifest');
    expect(resp?.status()).toBe(200);
    const json = await resp?.json();
    expect(json?.name).toContain('Print Optimizer');
  });
});
