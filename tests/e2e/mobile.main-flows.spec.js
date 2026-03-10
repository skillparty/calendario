import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** @param {import('@playwright/test').Page} page */
async function openHome(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
}

/** @param {import('@playwright/test').Page} page */
async function swipeWeeklyGrid(page, direction) {
  await page.locator('.weekly-grid').evaluate((el, dir) => {
    const startX = dir === 'left' ? 320 : 60;
    const endX = dir === 'left' ? 80 : 320;
    const y = 220;

    const startEvent = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(startEvent, 'changedTouches', {
      value: [{ screenX: startX, screenY: y }],
    });

    const endEvent = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperty(endEvent, 'changedTouches', {
      value: [{ screenX: endX, screenY: y }],
    });

    el.dispatchEvent(startEvent);
    el.dispatchEvent(endEvent);
  }, direction);
}

test.describe('Mobile Main Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.addInitScript(() => window.localStorage.clear());
    await openHome(page);
  });

  test('weekly mobile uses 3-day window and reacts to swipe', async ({ page }) => {
    await page.locator('#bottom-weekly-btn').click({ force: true });
    await expect(page.locator('#weekly-view')).toBeVisible();

    const dayHeaders = page.locator('.weekly-day-header');
    await expect(dayHeaders).toHaveCount(3);

    const firstBefore = (await dayHeaders.nth(0).locator('.weekly-day-number').innerText()).trim();
    await swipeWeeklyGrid(page, 'left');

    const firstAfter = (await dayHeaders.nth(0).locator('.weekly-day-number').innerText()).trim();
    expect(firstAfter).not.toBe(firstBefore);
  });

  test('agenda mobile filters can be expanded and collapsed', async ({ page }) => {
    await page.locator('#bottom-agenda-btn').click({ force: true });
    await expect(page.locator('#agenda-view')).toBeVisible();

    const toggle = page.locator('.mobile-filter-toggle');
    const filterPanel = page.locator('#agenda-mobile-filters');

    await expect(toggle).toBeVisible();
    await expect(filterPanel).not.toHaveClass(/open/);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(filterPanel).toHaveClass(/open/);

    await filterPanel.locator('select').first().selectOption('2');
    await expect(filterPanel).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(filterPanel).not.toHaveClass(/open/);
  });

  test('day modal keeps internal task list scroll on mobile', async ({ page }) => {
    await page.addInitScript(() => {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const todayKey = `${y}-${m}-${d}`;

      const tasks = Array.from({ length: 18 }, (_, i) => ({
        id: `task-${i + 1}`,
        title: `Tarea mobile ${i + 1}`,
        description: `Detalle ${i + 1}`,
        completed: false,
        priority: (i % 3) + 1,
        date: todayKey,
        time: null,
      }));

      localStorage.setItem('calendarTasks', JSON.stringify({ [todayKey]: tasks }));
    });

    await page.reload();
    await page.locator('.day.today .day-number').click();

    const dayModal = page.locator('.modal.view-svelte-modal .modal-content');
    const taskContainer = page.locator('#modal-tasks.modal-tasks-scroll');

    await expect(dayModal).toBeVisible();
    await expect(taskContainer).toBeVisible();

    const metrics = await taskContainer.evaluate((el) => {
      const styles = getComputedStyle(el);
      return {
        overflowY: styles.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });

    expect(metrics.overflowY).toBe('auto');
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  });
});
