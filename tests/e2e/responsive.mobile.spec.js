import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { name: 'mobile-compact-360x740', width: 360, height: 740 },
  { name: 'mobile-standard-390x844', width: 390, height: 844 },
  { name: 'mobile-large-412x915', width: 412, height: 915 }
];

/**
 * @param {import('@playwright/test').Page} page
 */
async function openHome(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(250);
    }
  }
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function assertCoreMobileNav(page) {
  await expect(page.locator('#bottom-calendar-btn')).toBeVisible();
  await expect(page.locator('#bottom-agenda-btn')).toBeVisible();
  await expect(page.locator('#bottom-weekly-btn')).toBeVisible();
  await expect(page.locator('#bottom-calendar-btn')).toHaveAttribute('aria-pressed', 'true');

  const header = page.locator('.header-minimal');
  const headerBox = await header.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox?.height || 999).toBeLessThan(300);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`Responsive Mobile Matrix - ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => window.localStorage.clear());
      await openHome(page);
    });

    test('calendar mobile layout is usable', async ({ page }) => {
      await assertCoreMobileNav(page);
      await page.locator('#bottom-calendar-btn').click();
      await expect(page.locator('#calendar-view')).toBeVisible();
      await expect(page.locator('.calendar-nav h2')).toBeVisible();
      await expect(page.locator('#prev-month')).toBeVisible();
      await expect(page.locator('#next-month')).toBeVisible();

    });

    test('agenda mobile shows quick-actions and stats blocks', async ({ page }) => {
      await assertCoreMobileNav(page);
      await page.locator('#bottom-agenda-btn').click({ force: true });
      await expect(page.locator('#bottom-agenda-btn')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#agenda-view')).toBeVisible();

      const quickActions = page.locator('.quick-actions-block');
      const stats = page.locator('.stats-block');

      await expect(quickActions).toBeVisible();
      await expect(stats).toBeVisible();
      await expect(quickActions.locator('.btn-action').first()).toBeVisible();
      await expect(stats.locator('.stat-item').first()).toBeVisible();

    });

    test('weekly mobile keeps navigation and grid visible', async ({ page }) => {
      await assertCoreMobileNav(page);
      await page.locator('#bottom-weekly-btn').click({ force: true });
      await expect(page.locator('#bottom-weekly-btn')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#weekly-view')).toBeVisible();
      await expect(page.locator('.weekly-nav')).toBeVisible();
      await expect(page.locator('#prev-week')).toBeVisible();
      await expect(page.locator('#today-week')).toBeVisible();
      await expect(page.locator('#next-week')).toBeVisible();
      await expect(page.locator('.weekly-grid')).toBeVisible();
    });
  });
}
