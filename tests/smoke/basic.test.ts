import { test, expect } from '@playwright/test';

test.describe('Cross-browser smoke tests', () => {
  test('page loads and renders header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('text=Print Optimizer')).toBeVisible();
  });

  test('shows tool selection on initial load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Choose a Tool')).toBeVisible();
    await expect(page.locator('text=Dark Notes').first()).toBeVisible();
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
