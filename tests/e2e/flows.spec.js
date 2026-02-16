import { test, expect } from '@playwright/test';

/**
 * Helper to create a task via UI
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 */
async function createTask(page, title) {
  // Ensure we are on calendar view
  if (await page.locator('#calendar-view').isHidden()) {
    await page.locator('#calendar-btn').click();
  }
  
  // Click today
  const todayCell = page.locator('.day.today');
  await todayCell.hover();
  // Try clicking the add button directly if visible, else the day cell then add button
  if (await todayCell.locator('.day-add-btn').isVisible()) {
    await todayCell.locator('.day-add-btn').click();
  } else {
    // Click day content to open day modal, then add
    await todayCell.locator('.day-content').click();
    await page.locator('#add-task-modal-btn').click();
  }

  const modal = page.locator('.modal[data-modal-type="task-input"]');
  await expect(modal).toBeVisible();
  
  await modal.locator('#task-title-input').fill(title);
  await modal.locator('button[data-action="save-task-modal"]').click();
  await expect(modal).not.toBeVisible();
  
  // Verify it appears in grid immediately
  await expect(todayCell.locator('.task-preview-item', { hasText: title })).toBeVisible();
}

test.describe('Calendar10 Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage (use evaluate instead of addInitScript to avoid clearing on reload)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload(); // Reload to ensure clean state
  });

  test('should create a task and see it in calendar', async ({ page }) => {
    await createTask(page, 'Test Task E2E');
    // Helper already verifies visibility
    await page.reload();
  });

  test('should verify task in agenda and inline edit', async ({ page }) => {
    await createTask(page, 'Initial Title');
    
    await page.waitForTimeout(500); 
    await page.reload(); 

    // Switch to Agenda
    await page.locator('#agenda-btn').click();
    await expect(page.locator('#agenda-view')).toBeVisible();

    // Find task card
    const cardTitle = page.locator('.task-card-title', { hasText: 'Initial Title' }).first();
    await expect(cardTitle).toBeVisible();

    // Inline edit title
    await cardTitle.click();
    const input = page.locator('.inline-title-input');
    await expect(input).toBeVisible();
    await input.fill('Edited Title E2E');
    await input.press('Enter');

    // Verify change
    await expect(page.locator('.task-card-title', { hasText: 'Edited Title E2E' })).toBeVisible();
  });

  test('should delete task from Day Modal', async ({ page }) => {
    await createTask(page, 'Day Delete');
    await page.reload();
    
    // Open Day Modal by clicking the day content
    const todayCellContent = page.locator('.day.today .day-content');
    await todayCellContent.locator('.day-number').click();
    
    const dayModal = page.locator('#day-modal');
    await expect(dayModal).toBeVisible();
    
    const taskItem = dayModal.locator('.modal-task', { hasText: 'Day Delete' });
    await expect(taskItem).toBeVisible();
    
    const deleteBtn = taskItem.locator('button[data-action="delete-task"]');
    await deleteBtn.click();
    
    // Modal closes on delete (to show toast)
    await expect(dayModal).not.toBeVisible();
    
    // Verify toast using accessible role
    const toast = page.getByRole('alert');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('eliminada');
    
    // Undo
    await toast.locator('button', { hasText: 'Deshacer' }).click();
    
    // Re-open Day Modal to verify task restoration
    await todayCellContent.locator('.day-number').click();
    await expect(dayModal).toBeVisible();
    await expect(dayModal.locator('.modal-task', { hasText: 'Day Delete' })).toBeVisible();
  });
});
